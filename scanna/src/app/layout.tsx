import type { Metadata, Viewport } from "next";
import { Space_Grotesk, Inter, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://scanna.app";
const ogImage = "https://placehold.co/1200x630/1C1815/FAF7F1?text=Scanna&font=roboto";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Scanna — Scan Cards, Know Their Value, Sell Smarter",
    template: "%s",
  },
  description:
    "Scan a sports card to identify it, get a researched value estimate, and manage your whole resale inventory — from acquisition to eBay sale.",
  applicationName: "Scanna",
  manifest: "/manifest.json",
  icons: {
    icon: [{ url: "https://placehold.co/64x64/1C1815/C08829?text=S", sizes: "64x64" }],
    apple: "https://placehold.co/180x180/1C1815/C08829?text=S",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    title: "Scanna — Scan Cards, Know Their Value, Sell Smarter",
    description:
      "Scan a sports card to identify it, get a researched value estimate, and manage your whole resale inventory — from acquisition to eBay sale.",
    images: [ogImage],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scanna — Scan Cards, Know Their Value, Sell Smarter",
    description:
      "Scan a sports card to identify it, get a researched value estimate, and manage your whole resale inventory — from acquisition to eBay sale.",
    images: [ogImage],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1C1815",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${inter.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bone text-ink">
        {/* Wrapped in its own landmark (rather than left bare in <body>) —
            an axe-core pass flagged the skip link as page content not
            contained by any landmark. */}
        <nav aria-label="Skip links">
          <a
            href="#main-content"
            className="sr-only-focusable fixed top-2 left-2 z-50 rounded bg-ink px-4 py-2 text-bone"
          >
            Skip to content
          </a>
        </nav>
        <ToastProvider>{children}</ToastProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
