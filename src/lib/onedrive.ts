/**
 * Turning a share link into bytes.
 *
 * A OneDrive share link points at a viewer page, not at the file, and which
 * endpoint serves the bytes depends on something the link does not tell you:
 * whether that personal account has been migrated to SharePoint Online. Microsoft
 * is moving every consumer account across, and for a migrated one the old
 * anonymous endpoint — `api.onedrive.com/v1.0/shares/u!<base64url>/root/content` —
 * answers 401 `unauthenticated` no matter how public the link is. Migrated files
 * live at `my.microsoftpersonalcontent.com` and download through the ordinary
 * SharePoint route, `_layouts/15/download.aspx?share=<id>`.
 *
 * So a OneDrive link resolves to a *list* of candidates and `fetchSource` tries
 * them in order. Guessing costs one extra request in the worst case and removes a
 * dead end the user has no way to diagnose.
 *
 * SharePoint / OneDrive for Business links take a `download=1` parameter instead.
 * Everything else is passed through untouched, so a plain https URL to an .xlsx
 * still works.
 *
 * When Pulse later grows a "Sign in with Microsoft" flow, only this file changes:
 * the rest of the app already talks to `fetchSource()`.
 */

export type SourceKind = "onedrive-share" | "sharepoint" | "direct" | "local";

export interface ResolvedSource {
  kind: SourceKind;
  /** Endpoints to GET, in order of preference. Usually one; OneDrive needs two. */
  requestUrls: string[];
  /** Short, human label for the header ("OneDrive · Financas.xlsx"). */
  label: string;
}

export function resolveSource(input: string): ResolvedSource {
  const raw = input.trim();
  if (!raw) throw new SourceError("Nenhuma fonte de dados configurada.");

  if (!/^https?:\/\//i.test(raw)) {
    return { kind: "local", requestUrls: [raw], label: `Arquivo local · ${basename(raw)}` };
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
      return { kind: "direct", requestUrls: [url.toString()], label: `OneDrive · ${basename(url.pathname)}` };
    }

    const candidates: string[] = [];
    const share = shareIds(url);
    if (share) {
      candidates.push(
        `https://my.microsoftpersonalcontent.com/personal/${share.driveId}/_layouts/15/download.aspx?share=${encodeURIComponent(share.shareId)}`,
      );
    }
    candidates.push(`https://api.onedrive.com/v1.0/shares/u!${base64Url(url.toString())}/root/content`);

    return { kind: "onedrive-share", requestUrls: candidates, label: "OneDrive · link compartilhado" };
  }

  // OneDrive for Business / SharePoint.
  if (host.endsWith("sharepoint.com")) {
    const out = new URL(url.toString());
    out.searchParams.set("download", "1");
    return { kind: "sharepoint", requestUrls: [out.toString()], label: `SharePoint · ${basename(url.pathname)}` };
  }

  // Google Sheets published as xlsx, Dropbox, a raw file on a server: pass through,
  // with the one tweak Dropbox needs.
  if (host.endsWith("dropbox.com")) {
    const out = new URL(url.toString());
    out.searchParams.set("dl", "1");
    return { kind: "direct", requestUrls: [out.toString()], label: `Dropbox · ${basename(url.pathname)}` };
  }

  return { kind: "direct", requestUrls: [url.toString()], label: `${host} · ${basename(url.pathname)}` };
}

/**
 * The drive and share ids buried in a modern OneDrive link.
 *
 *   https://1drv.ms/x/c/f9d77a32a3bc6988/IQB20Fw_CZUy…
 *   https://onedrive.live.com/:x:/g/personal/F9D77A32A3BC6988/IQB20Fw_CZUy…
 *
 * Both put a 16-digit hex drive id immediately before the share id, which is the
 * only stable thing about these paths — the segments around it have changed more
 * than once. Older links (`/x/s!AhY…`) carry no drive id at all and return null,
 * which is fine: those accounts are the ones the legacy endpoint still serves.
 */
function shareIds(url: URL): { driveId: string; shareId: string } | null {
  const segments = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);

  for (let i = 0; i < segments.length - 1; i++) {
    if (/^[0-9a-f]{16}$/i.test(segments[i]) && segments[i + 1]) {
      return { driveId: segments[i].toLowerCase(), shareId: segments[i + 1] };
    }
  }
  return null;
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
    const path = source.requestUrls[0];
    const { readFile } = await import("node:fs/promises");
    try {
      const buffer = await readFile(path);
      const bytes = new Uint8Array(buffer);
      return { bytes, format: sniffFormat(bytes, path), label: source.label };
    } catch {
      throw new SourceError(
        `Não consegui abrir o arquivo "${path}".`,
        "Confira o caminho. Em Windows use barras normais, ex.: C:/Users/você/OneDrive/financas.xlsx",
      );
    }
  }

  // Try each candidate; the first that answers wins, and the last failure is the
  // one reported, since candidates are ordered most-likely first.
  let failure: SourceError | null = null;
  let response: Response | null = null;

  for (const candidate of source.requestUrls) {
    assertPublicHost(candidate);

    let attempt: Response;
    try {
      attempt = await fetch(candidate, {
        redirect: "follow",
        headers: { Accept: "*/*", "User-Agent": "Pulse/0.1 (+financas)" },
        cache: "no-store",
      });
    } catch {
      failure = new SourceError(
        "Não consegui alcançar o link.",
        "Verifique a conexão e se o link continua válido.",
      );
      continue;
    }

    if (attempt.ok) {
      response = attempt;
      break;
    }

    failure = new SourceError(
      `O link respondeu ${attempt.status}.`,
      attempt.status === 401 || attempt.status === 403
        ? 'O arquivo precisa estar compartilhado como "qualquer pessoa com o link pode ver". No OneDrive: Compartilhar › Qualquer pessoa com o link › Pode visualizar.'
        : "Abra o link no navegador para confirmar que ele ainda funciona.",
    );
  }

  if (!response) throw failure ?? new SourceError("Não consegui alcançar o link.");

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

  return { bytes, format: sniffFormat(bytes, filename ?? response.url, contentType), label };
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
