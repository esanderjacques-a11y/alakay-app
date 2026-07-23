import type { Metadata } from "next";
import { DM_Sans, Manrope, Nunito, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import MobilePwaBootstrap from "@/components/MobilePwaBootstrap";
import ScrollEdgeButtons from "@/components/ui/ScrollEdgeButtons";

const nunito = Nunito({
  subsets: ["latin", "latin-ext"],
  variable: "--font-nunito",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin", "latin-ext"],
  variable: "--font-source-sans",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  variable: "--font-dm-sans",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin", "latin-ext"],
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  applicationName: "CULTOSOL",
  title: "CULTOSOL - Soil & foliar interpretation",
  description: "Interpret soil and foliar lab results for small producers.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    title: "CULTOSOL",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  /* Keep fixed chrome (dock) stable when the soft keyboard opens. */
  interactiveWidget: "resizes-visual",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#059669" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${nunito.variable} ${sourceSans.variable} ${dmSans.variable} ${manrope.variable}`}
      data-glass-ui="true"
      data-app-font="system"
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col overscroll-none">
        <MobilePwaBootstrap />
        <ScrollEdgeButtons />
        {children}
      </body>
    </html>
  );
}
