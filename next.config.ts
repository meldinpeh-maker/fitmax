import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export — FITMAX is fully client-side (IndexedDB), so it ships as
  // pure static files. Hosted on GitHub Pages under /fitmax/.
  output: "export",
  basePath: "/fitmax",
  assetPrefix: "/fitmax",
};

export default nextConfig;
