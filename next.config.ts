import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typescript: { ignoreBuildErrors: false },
  // better-sqlite3 is a native module and must stay out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Heavy visualisation libraries are loaded lazily at the route level.
    optimizePackageImports: ["@tabler/icons-react", "d3"],
  },
};

export default nextConfig;
