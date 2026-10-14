import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { TopNav } from "@/components/TopNav";
import { APP_NAME, APP_SHORT_NAME, COMPANY } from "@/lib/brand";
import { KEYWORDS, SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";
import { RegisterSW } from "@/components/RegisterSW";
import { TourHost } from "@/components/Tour";
import { VisitBeacon } from "@/components/VisitBeacon";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${APP_NAME}: Solar Home System Design Software`, template: `%s · ${APP_NAME}` },
  description: SITE_DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: APP_NAME,
  category: "engineering",
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    locale: "en_NG",
    url: "/",
    title: `${APP_NAME}: Solar Home System Design Software`,
    description: SITE_DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: `${APP_NAME}: Solar Home System Design Software`, description: SITE_DESCRIPTION },
  // Search Console / Bing ownership tokens, if configured.
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.NEXT_PUBLIC_BING_SITE_VERIFICATION } : undefined,
  },
  authors: [{ name: COMPANY.name, url: COMPANY.website }],
  creator: COMPANY.name,
  publisher: COMPANY.name,
  appleWebApp: { capable: true, title: APP_SHORT_NAME, statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/pwa-icon/180" },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // lets safe-area insets work in the installed app on notched phones
};

/** Applies a saved theme before first paint so the page never flashes the other theme. */
const THEME_INIT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="flex min-h-screen flex-col">
        <TopNav />
        <div className="flex-1">{children}</div>
        <SiteFooter />
        <RegisterSW />
        <VisitBeacon />
        <TourHost />
      </body>
    </html>
  );
}
