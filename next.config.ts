import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * The output directory is overridable.
   *
   * A production build and the development server both write to `.next` by
   * default, so verifying the build meant stopping the server a reviewer or a
   * test run was using. Pointing the build at its own directory lets both run
   * at once, which matters here because the end to end suite needs a live
   * server for several minutes at a time.
   */
  distDir: process.env.NFR_DIST_DIR ?? ".next",
  typescript: { ignoreBuildErrors: false },
  /*
   * The development indicator is off.
   *
   * It is a floating badge anchored to the bottom left of the viewport, which
   * is where the updates bar's own control sits. On a screenshot of the V3.1
   * role home it covered the `Updates` toggle completely, and it was already
   * recorded against the V2 day player as an open defect for the same reason:
   * a reviewer could not click the play control. It is a development only
   * overlay, so removing it changes nothing about the application and makes
   * the screenshots and the end to end runs show what a user would see.
   */
  devIndicators: false,
  // better-sqlite3 is a native module and must stay out of the bundle.
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // Heavy visualisation libraries are loaded lazily at the route level.
    optimizePackageImports: ["@tabler/icons-react", "d3"],
  },
};

export default nextConfig;
