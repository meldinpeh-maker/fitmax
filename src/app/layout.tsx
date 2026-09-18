import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TabBar } from "@/components/TabBar";

export const metadata: Metadata = {
  title: "FITMAX — Home Workout Tracker",
  description: "Track your home gym equipment and every workout. On-device, private, fast.",
  manifest: "/manifest.webmanifest",
  applicationName: "FITMAX",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FITMAX",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0b0d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <main id="main">{children}</main>
        <TabBar />
      </body>
    </html>
  );
}
