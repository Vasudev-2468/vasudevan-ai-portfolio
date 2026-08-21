import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vasudevan.ai",
    short_name: "Vasudevan.ai",
    description:
      "AI portfolio of Vasudevan Sundaramurthy — research, projects, and a talking AI avatar.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0510",
    theme_color: "#0a0510",
    icons: [
      {
        src: "/favicon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/images/avatar.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
