import type { Metadata, Viewport } from "next";
import { TopNav } from "@/components/TopNav";
import { RegisterSW } from "@/components/RegisterSW";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "SolarDesign Pro", template: "%s · SolarDesign Pro" },
  description: "Engineer-grade solar home system design: load audit, sizing, string design, SLD, BoQ, financials and progress tracking.",
  applicationName: "SolarDesign Pro",
  appleWebApp: { capable: true, title: "SolarDesign", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/pwa-icon/180" },
};

export const viewport: Viewport = {
  themeColor: "#d97706",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <TopNav />
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
