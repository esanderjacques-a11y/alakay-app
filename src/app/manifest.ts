import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ALAKAY - Soil & foliar interpretation",
    short_name: "ALAKAY",
    description: "Interpret soil and foliar lab results.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4fff8",
    theme_color: "#059669",
    icons: [
      {
        src: "/icon-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
