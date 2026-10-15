import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/calculator", "/credits", "/register", "/login"],
      // Signed-in areas and the API hold private project data and are useless to search engines.
      disallow: ["/api/", "/dashboard", "/projects/", "/equipment", "/orgs", "/approvals", "/account", "/admin", "/offline", "/locate/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
