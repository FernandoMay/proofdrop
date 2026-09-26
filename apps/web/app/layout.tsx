import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@pollar/react/styles.css";
import type { Metadata } from "next";

import { ModeBanner } from "@/components/mode-banner";
import { PollarProviderBoundary } from "@/components/pollar-provider-boundary";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const SITE_URL = "https://proof-drop.netlify.app";
const SITE_TITLE = "ProofDrop · Pagos verificables";
const SITE_DESCRIPTION =
  "Solicitudes de micropago USDC en Stellar Testnet con verificación independiente, manifiesto canónico y hash SHA-256 público. Stellar primero, anclaje opcional en Avalanche Fuji.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "ProofDrop",
  title: {
    default: SITE_TITLE,
    template: "%s · ProofDrop",
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: "/brand/logo-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/logo-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/brand/logo-192.png",
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    siteName: "ProofDrop",
    locale: "es",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: "/brand/og-cover.jpg",
        width: 1200,
        height: 630,
        alt: "Marca ProofDrop: escudo con la inicial P y una flecha ascendente.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/brand/og-cover.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>
        <PollarProviderBoundary>
          <ModeBanner />
          <SiteHeader />
          <main>{children}</main>
          <footer className="site-footer">
            <div className="container footer-inner">
              <span>ProofDrop MVP · Redes reales solo en modo real</span>
              <span>El hash público no es una prueba de conocimiento cero.</span>
            </div>
          </footer>
        </PollarProviderBoundary>
      </body>
    </html>
  );
}
