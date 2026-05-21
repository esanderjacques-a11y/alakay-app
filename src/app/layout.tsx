import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Alakay — Soil & foliar interpretation",
  description:
    "Interpret soil and foliar lab results for small producers.",
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
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <body className="flex min-h-full flex-col overscroll-none">
        {children}
      </body>
    </html>
  );
}
