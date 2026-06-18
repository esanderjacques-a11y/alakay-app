import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "ALAKAY",
  title: "ALAKAY - Soil & foliar interpretation",
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
    title: "ALAKAY",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
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
        {children}
      </body>
    </html>
  );
}
