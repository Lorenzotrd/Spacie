import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Atelio",
    short_name: "Atelio",
    description: "The collaborative filesystem for humans and AI agents.",
    start_url: "/workspace",
    display: "standalone",
    background_color: "#F3F2EE",
    theme_color: "#2B59D9",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
