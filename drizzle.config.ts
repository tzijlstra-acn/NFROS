import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  dbCredentials: { url: "./data/nfr-workos.db" },
  strict: true,
  verbose: false,
} satisfies Config;
