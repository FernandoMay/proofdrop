import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import type { Metadata } from "next";

import { ModeBanner } from "@/components/mode-banner";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ProofDrop · Pagos verificables",
    template: "%s · ProofDrop",
  },
  description: "Solicitudes de micropago USDC con verificación independiente y hash canónico.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <ModeBanner />
        <SiteHeader />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container footer-inner">
            <span>ProofDrop MVP · Redes reales solo en modo real</span>
            <span>El hash público no es una prueba de conocimiento cero.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
