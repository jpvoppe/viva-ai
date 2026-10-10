import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VIVA AI",
    short_name: "VIVA",
    description: "O assistente inteligente para a vida cotidiana.",
    lang: "pt-BR",
    start_url: "/app",
    display: "standalone",
    background_color: "#fbfafd",
    theme_color: "#15131c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
