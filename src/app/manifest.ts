import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SolarDesign Pro: Solar Home System Design",
    short_name: "SolarDesign",
    description: "Design, size and track solar home system projects: load audit to design report.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f6f7f9",
    theme_color: "#d97706",
    categories: ["productivity", "utilities", "business"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Projects", url: "/dashboard" },
      { name: "Quick calculator", url: "/calculator" },
    ],
  };
}
