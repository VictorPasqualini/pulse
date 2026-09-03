import type { Metadata, Viewport } from "next";
import { paletteCSS } from "@/lib/palette";
import { Sidebar } from "@/components/chrome/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Pulse", template: "%s · Pulse" },
  description:
    "Painel de entradas, saídas e investimentos lido direto da sua planilha do OneDrive.",
  applicationName: "Pulse",
  authors: [{ name: "Pulse" }],
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0b0f0e" },
    { media: "(prefers-color-scheme: light)", color: "#f3f6f5" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        {/* The validated palette, emitted once. Charts read the custom properties;
            no component knows the hexes, so none can drift from a checked value. */}
        <style id="pulse-palette">{paletteCSS()}</style>
        {/* Applies the saved theme before first paint, so a light-mode user never
            sees a dark flash. Nothing else runs before hydration. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem("pulse-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh">
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </body>
    </html>
  );
}
