import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Obratrix — Gestão de obras",
    short_name: "Obratrix",
    description: "Planejamento, execução e custos de obras em um só lugar.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f7f8f6",
    theme_color: "#126747",
    lang: "pt-BR",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
