import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output is required for the multi-stage Dockerfile runner stage.
  // It copies only the minimal server files into .next/standalone so the
  // container image does not need node_modules at runtime.
  output: "standalone",
  /*
   * Redirects for deprecated flagship-role routes.
   *
   * V3.2 reduces the flagship nav to Home, Processes and Decisions. Routes
   * that were primary items before (workbench, meetings, mail, calendar,
   * collaboration, assistant) now redirect so any bookmarks or external links
   * still resolve. permanent: false allows the destinations to change again
   * without forcing browsers to cache the 308 forever.
   *
   * Only rcsa and tprm are flagship roles. Preview roles keep their routes
   * as-is; they redirect to the role home where a stub page does not exist.
   */
  async redirects() {
    const flagship = ["rcsa", "tprm"] as const;
    const rules: { source: string; destination: string; permanent: boolean }[] = [];

    for (const role of flagship) {
      rules.push(
        /*
         * V3.3 maps all personal-work routes to the Work Hub with the
         * appropriate tab pre-selected. The old assistant route drops the
         * partner=open query because the partner panel is now opened from
         * within the role home, not by a dedicated route.
         */
        {
          source: `/workday/${role}/calendar`,
          destination: `/workday/${role}/work?view=agenda`,
          permanent: false,
        },
        {
          source: `/workday/${role}/meetings`,
          destination: `/workday/${role}/work?view=meetings`,
          permanent: false,
        },
        {
          source: `/workday/${role}/mail`,
          destination: `/workday/${role}/work?view=inbox`,
          permanent: false,
        },
        {
          source: `/workday/${role}/collaboration`,
          destination: `/workday/${role}/work?view=inbox`,
          permanent: false,
        },
        {
          source: `/workday/${role}/workbench`,
          destination: `/workday/${role}/processes`,
          permanent: false,
        },
        {
          source: `/workday/${role}/assistant`,
          destination: `/workday/${role}`,
          permanent: false,
        },
      );
    }

    return rules;
  },

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
