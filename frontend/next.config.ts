import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["three"],
  async rewrites() {
    const target = process.env.BACKEND_URL ?? "http://backend:8000";
    return [{ source: "/api/:path*", destination: `${target}/api/:path*` }];
  },
};

export default nextConfig;
