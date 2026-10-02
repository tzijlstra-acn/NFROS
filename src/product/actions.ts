"use server";

/**
 * Server actions for the administrator settings area.
 *
 * Two properties these actions are built to hold.
 *
 * First, a product configuration change touches product configuration tables
 * only. Switching the branding mode writes one row on `active_product_config`
 * and one row on `product_config_changes`, and nothing else in the database
 * moves. That is not a convention, it is the whole claim of the configuration
 * layer, so the write is deliberately narrow enough to read in one screen.
 *
 * Second, a configuration change is recorded separately from the domain audit
 * trail. A reviewer asking who changed the branding and a reviewer asking who
 * approved a residual risk rating are asking different questions of different
 * systems, and merging the two logs would make both harder to read.
 */

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db/client";
import {
  activeProductConfig,
  brandProfiles,
  productConfigChanges,
} from "@/db/schema/product";
import { createLogger } from "@/server/logging/redact";
import { ACTIVE_PRODUCT_CONFIG_ID, resetProductConfigCaches } from "./organisation/profile";

const log = createLogger("product-config");

const brandProfileIdSchema = z
  .string()
  .min(3)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "A brand profile identifier is lower case, digits and hyphens.");

/**
 * Who the change is attributed to.
 *
 * There is no authentication in this build, so attributing the change to a
 * named person would be an invention. "administrator" is the honest actor
 * label for an unauthenticated local prototype, and the deployment profile
 * screen says why.
 */
const ACTOR = "administrator";

/**
 * Switches the active brand profile.
 *
 * Writes the override column rather than editing the organisation profile.
 * Branding is presentation; the organisation profile describes the institution
 * and its entities, and a presentation change that rewrote it would be a
 * change to the institution record for no reason.
 */
export async function actionSetBrandProfile(formData: FormData): Promise<void> {
  const parsed = brandProfileIdSchema.parse(formData.get("brandProfileId"));
  const db = getDb();

  const target = db.select().from(brandProfiles).where(eq(brandProfiles.id, parsed)).get();
  if (!target) {
    /*
     * Refuse rather than write a pointer to a profile that does not exist. The
     * resolver would fall back to the unconfigured brand, and the interface
     * would show "Not configured" with no explanation of what went wrong.
     */
    log.warn("Brand profile switch refused: no such profile.", { brandProfileId: parsed });
    return;
  }

  const current = db
    .select()
    .from(activeProductConfig)
    .where(eq(activeProductConfig.id, ACTIVE_PRODUCT_CONFIG_ID))
    .get();
  if (!current) {
    log.warn("Brand profile switch refused: no active product configuration row.");
    return;
  }

  const previousBrandId = current.brandProfileIdOverride;
  if (previousBrandId === parsed) return;

  const at = new Date().toISOString();

  db.update(activeProductConfig)
    .set({ brandProfileIdOverride: parsed, updatedAt: at, updatedBy: ACTOR })
    .where(eq(activeProductConfig.id, ACTIVE_PRODUCT_CONFIG_ID))
    .run();

  db.insert(productConfigChanges)
    .values({
      /*
       * The timestamp is in the identifier because these rows are append only
       * and ordered by time, and a sequence counter would need a read of the
       * table to allocate. Two changes inside the same millisecond would
       * collide, which for a settings screen operated by one person at a time
       * is not a failure mode worth a sequence table.
       */
      id: `PCC-${at}`,
      at,
      area: "branding",
      summary: `Branding switched to ${target.mode} mode, profile ${target.id}. No domain record was changed.`,
      previousValue: { brandProfileIdOverride: previousBrandId },
      newValue: { brandProfileIdOverride: parsed, mode: target.mode },
      changedBy: ACTOR,
    })
    .run();

  resetProductConfigCaches();

  /*
   * The workday is revalidated as well as the settings area, because the shell
   * reads the brand identity on every render. Without this the administrator
   * sees the new branding in settings and the old branding in the application,
   * which looks exactly like the fork the configuration layer exists to avoid.
   */
  revalidatePath("/settings", "layout");
  revalidatePath("/workday", "layout");

  log.info("Branding switched.", { from: previousBrandId, to: parsed, mode: target.mode });
}

/**
 * Clears the branding override.
 *
 * Returns to whatever brand the organisation profile names, which is the
 * seeded client branding. Kept separate from the switch action because
 * "return to the configured default" and "choose this profile" are different
 * administrator intentions and should read differently in the change log.
 */
export async function actionClearBrandOverride(): Promise<void> {
  const db = getDb();
  const current = db
    .select()
    .from(activeProductConfig)
    .where(eq(activeProductConfig.id, ACTIVE_PRODUCT_CONFIG_ID))
    .get();
  if (!current || current.brandProfileIdOverride === null) return;

  const at = new Date().toISOString();
  const previousBrandId = current.brandProfileIdOverride;

  db.update(activeProductConfig)
    .set({ brandProfileIdOverride: null, updatedAt: at, updatedBy: ACTOR })
    .where(eq(activeProductConfig.id, ACTIVE_PRODUCT_CONFIG_ID))
    .run();

  db.insert(productConfigChanges)
    .values({
      id: `PCC-${at}`,
      at,
      area: "branding",
      summary:
        "Branding override cleared. The organisation profile brand pointer is in force again. No domain record was changed.",
      previousValue: { brandProfileIdOverride: previousBrandId },
      newValue: { brandProfileIdOverride: null },
      changedBy: ACTOR,
    })
    .run();

  resetProductConfigCaches();
  revalidatePath("/settings", "layout");
  revalidatePath("/workday", "layout");
}

/*
 * The change log read deliberately does not live here. Every export of a
 * "use server" module becomes a callable endpoint, and a read has no business
 * being one. It is `listProductConfigChanges()` in `src/product/index.ts`.
 */
