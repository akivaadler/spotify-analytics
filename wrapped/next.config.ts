import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Next doesn't pick up the parent repo's lockfile.
  turbopack: { root: __dirname },
};

export default nextConfig;
