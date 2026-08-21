import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  async rewrites() {
    // Keep this in sync with the backend port in docker-compose.yml.
    const target = process.env.BACKEND_URL ?? "http://backend:4100";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
