import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Azure App Service: `next build` emits
  // .next/standalone with a self-contained server.js (no node_modules upload).
  output: "standalone",
  // Patient-file uploads (photos) go through a server action as FormData.
  experimental: {
    serverActions: { bodySizeLimit: "20mb" },
  },
};

export default nextConfig;
