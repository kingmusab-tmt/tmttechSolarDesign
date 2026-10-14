import type { MetadataRoute } from "next";
import { APP_NAME, APP_SHORT_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: `${APP_NAME}: Solar Home System Design`,
    short_name: APP_SHORT_NAME,
    description: "Design, size and track solar home system projects: load audit to design report.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#f6f7f9",
    theme_color: "#15803d",
    lang: "en-NG",
    dir: "ltr",
    categories: ["productivity", "utilities", "business"],
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-icon/maskable-192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/pwa-icon/maskable-512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
    shortcuts: [
      { name: "Projects", url: "/dashboard", icons: [{ src: "/pwa-icon/192", sizes: "192x192" }] },
      { name: "Quick calculator", url: "/calculator", icons: [{ src: "/pwa-icon/192", sizes: "192x192" }] },
      { name: "Equipment library", url: "/equipment", icons: [{ src: "/pwa-icon/192", sizes: "192x192" }] },
    ],
  };
}
