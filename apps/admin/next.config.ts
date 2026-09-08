import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@scandihaven/ui",
    "@scandihaven/commerce",
    "@scandihaven/db",
    "@scandihaven/auth",
    "@scandihaven/config",
  ],
};

export default nextConfig;
