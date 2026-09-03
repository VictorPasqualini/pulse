/**
 * Turning a share link into bytes.
 *
 * OneDrive share links point at a viewer page, not at the file. There is a
 * documented anonymous endpoint for "anyone with the link" shares —
 * `api.onedrive.com/v1.0/shares/u!<base64url>/root/content` — and SharePoint /
 * OneDrive for Business links take a `download=1` parameter instead. Everything
 * else is passed through untouched, so a plain https URL to an .xlsx still works.
 *
 * When Pulse later grows a "Sign in with Microsoft" flow, only this file changes:
 * the rest of the app already talks to `fetchSource()`.
 */

export type SourceKind = "onedrive-share" | "sharepoint" | "direct" | "local";

export interface ResolvedSource {
  kind: SourceKind;
  /** Where to actually GET the bytes. */
  requestUrl: string;
  /** Short, human label for the header ("OneDrive · Financas.xlsx"). */
  label: string;
}

export function resolveSource(input: string): ResolvedSource {
  const raw = input.trim();
  if (!raw) throw new SourceError("Nenhuma fonte de dados configurada.");

  if (!/^https?:\/\//i.test(raw)) {
    return { kind: "local", requestUrl: raw, label: `Arquivo local · ${basename(raw)}` };
  }

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new SourceError("O link informado não é uma URL válida.");
  }

  const host = url.hostname.toLowerCase();

  // Personal OneDrive: short links and the live.com viewer.
  if (host === "1drv.ms" || host.endsWith("onedrive.live.com")) {
    // A direct download URL from the viewer already works; leave it alone.
    if (url.pathname.toLowerCase().includes("/download")) {
      return { kind: "direct", requestUrl: url.toString(), label: `OneDrive · ${basename(url.pathname)}` };
    }
    const token = "u!" + base64Url(url.toString());
    return {
      kind: "onedrive-share",
      requestUrl: `https://api.onedrive.com/v1.0/shares/${token}/root/content`,
      label: "OneDrive · link compartilhado",
    };
  }

  // OneDrive for Business / SharePoint.
  if (host.endsWith("sharepoint.com")) {
    const out = new URL(url.toString());
    out.searchParams.set("download", "1");
    return { kind: "sharepoint", requestUrl: out.toString(), label: `SharePoint · ${basename(url.pathname)}` };
  }

  // Google Sheets published as xlsx, Dropbox, a raw file on a server: pass through,
  // with the one tweak Dropbox needs.
  if (host.endsWith("dropbox.com")) {
    const out = new URL(url.toString());
    out.searchParams.set("dl", "1");
    return { kind: "direct", requestUrl: out.toString(), label: `Dropbox · ${basename(url.pathname)}` };
  }

  return { kind: "direct", requestUrl: url.toString(), label: `${host} · ${basename(url.pathname)}` };
}

export class SourceError extends Error {
  hint?: string;
  constructor(message: string, hint?: string) {
    super(message);
    this.name = "SourceError";
    this.hint = hint;
  }
}

export interface FetchedFile {
  bytes: Uint8Array;
  /** "xlsx" | "csv" — decided by magic bytes first, extension second. */
  format: "xlsx" | "csv";
  label: string;
}

const MAX_BYTES = 40 * 1024 * 1024;

export async function fetchSource(input: string): Promise<FetchedFile> {
  const source = resolveSource(input);

  if (source.kind === "local") {
    const { readFile } = await import("node:fs/promises");
    try {
      const buffer = await readFile(source.requestUrl);
      const bytes = new Uint8Array(buffer);
      return { bytes, format: sniffFormat(bytes, source.requestUrl), label: source.label };
    } catch {
      throw new SourceError(
        `Não consegui abrir o arquivo "${source.requestUrl}".`,
        "Confira o caminho. Em Windows use barras normais, ex.: C:/Users/você/OneDrive/financas.xlsx",
      );
    }
  }

  assertPublicHost(source.requestUrl);

  let response: Response;
  try {
    response = await fetch(source.requestUrl, {
      redirect: "follow",
      headers: { Accept: "*/*", "User-Agent": "Pulse/0.1 (+financas)" },
      cache: "no-store",
    });
  } catch {
    throw new SourceError("Não consegui alcançar o link.", "Verifique a conexão e se o link continua válido.");
  }

  if (!response.ok) {
    throw new SourceError(
      `O link respondeu ${response.status}.`,
      response.status === 401 || response.status === 403
        ? 'O arquivo precisa estar compartilhado como "qualquer pessoa com o link pode ver".'
        : "Abra o link no navegador para confirmar que ele ainda funciona.",
    );
  }

  const declaredLength = Number(response.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BYTES) {
    throw new SourceError("A planilha passa de 40 MB.", "Divida o histórico em mais de um arquivo.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) throw new SourceError("O link devolveu um arquivo vazio.");
  if (bytes.byteLength > MAX_BYTES) throw new SourceError("A planilha passa de 40 MB.");

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new SourceError(
      "O link devolveu uma página HTML, não a planilha.",
      'No OneDrive use Compartilhar › Copiar link com acesso "qualquer pessoa com o link".',
    );
  }

  const filename = filenameFromDisposition(response.headers.get("content-disposition"));
  const label = filename ? `${source.label.split(" · ")[0]} · ${filename}` : source.label;

  return { bytes, format: sniffFormat(bytes, filename ?? source.requestUrl, contentType), label };
}

function sniffFormat(bytes: Uint8Array, name: string, contentType = ""): "xlsx" | "csv" {
  // Every .xlsx is a zip, and every zip starts with "PK\x03\x04".
  if (bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "xlsx";
  if (/\.xlsx?(\?|$)/i.test(name) || contentType.includes("spreadsheetml")) return "xlsx";
  return "csv";
}

function filenameFromDisposition(value: string | null): string | null {
  if (!value) return null;
  const utf8 = value.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1]);
    } catch {
      /* fall through to the plain form */
    }
  }
  const plain = value.match(/filename="?([^";]+)"?/i);
  return plain ? plain[1] : null;
}

function basename(path: string): string {
  const clean = path.split(/[?#]/)[0].replace(/\/+$/, "");
  const parts = clean.split(/[/\\]/);
  return decodeURIComponent(parts[parts.length - 1] || clean) || "planilha";
}

function base64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64").replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
}

/**
 * The source URL is user-supplied and fetched by the server, so refuse the hosts
 * that would turn Pulse into a probe for whatever else runs on this machine or
 * network. Local files have their own explicit branch above.
 */
function assertPublicHost(target: string): void {
  const host = new URL(target).hostname.toLowerCase();

  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".internal") ||
    host === "metadata.google.internal"
  ) {
    throw new SourceError("Endereços locais não são aceitos como fonte.");
  }

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127);
    if (isPrivate) throw new SourceError("Endereços de rede interna não são aceitos como fonte.");
  }

  if (host.startsWith("[") || host.includes(":")) {
    throw new SourceError("Endereços IPv6 não são aceitos como fonte.");
  }
}
