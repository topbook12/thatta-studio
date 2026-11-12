import type { NextConfig } from "next";

// `STANDALONE=1` → self-host docker/node packaging.
// On Vercel keep the default output for maximum build compatibility.
const nextConfig: NextConfig = {
  output: process.env.STANDALONE ? "standalone" : undefined,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
