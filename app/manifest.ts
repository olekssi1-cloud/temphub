import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Міщенки",
    short_name: "Міщенки",
    description: "Контроль температури та вентиляції",
    start_url: "/",
    display: "standalone",
    background_color: "#0b1220",
    theme_color: "#0b1220",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}