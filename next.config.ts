import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for custom server (Socket.io)
  experimental: {},
  // Disable static optimization for API routes that use Socket.io
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
