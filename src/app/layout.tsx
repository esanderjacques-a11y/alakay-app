import type { Metadata } from "next";
import "./globals.css";
import MobilePwaBootstrap from "@/components/MobilePwaBootstrap";
import ScrollEdgeButtons from "@/components/ui/ScrollEdgeButtons";

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
  interactiveWidget: "resizes-content",
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
      className="h-full antialiased"
      data-glass-ui="true"
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