import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Chronoguard: Anomaly",
  description: "Temporal Anomaly Detection System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* 1. Load Cesium CSS for the map styling */}
        <link href="https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Widgets/widgets.css" rel="stylesheet" />
        {/* 2. Load the main Cesium Engine */}
        <script src="https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Cesium.js" async></script>
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}