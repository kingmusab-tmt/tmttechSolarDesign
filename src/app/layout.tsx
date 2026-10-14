import type { Metadata, Viewport } from "next";
import { SiteFooter } from "@/components/SiteFooter";
import { TopNav } from "@/components/TopNav";
import { APP_NAME, APP_SHORT_NAME, COMPANY } from "@/lib/brand";
import { RegisterSW } from "@/components/RegisterSW";
import { VisitBeacon } from "@/components/VisitBeacon";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Engineer-grade solar home system design: load audit, sizing, string design, SLD, BoQ, financials and progress tracking.",
  applicationName: APP_NAME,
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
      </body>
    </html>
  );
}
