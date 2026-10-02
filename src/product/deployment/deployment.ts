/**
 * Deployment profile resolution and the honesty flags.
 *
 * Four deployment shapes are defined. One of them is what this repository
 * actually runs. The other three are architecture, written down so an
 * engagement can cost them, and the settings screen reads `implementedHere`
 * rather than asserting readiness.
 *
 * The reason this module exists as a resolver rather than as three paragraphs
 * of documentation: a capability claim that lives only in a document drifts
 * from the build within a sprint, and the first person to notice is a client
 * who tried it. Putting the claim in a column that the screen renders means
 * the claim and the build move together or the test fails.
 */

import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { deploymentProfiles, type DeploymentKind } from "@/db/schema/product";
import {
  createConfigCacheSlot,
  readThroughConfigCache,
  resolveOrganisationProfile,
} from "../organisation/profile";

type DeploymentProfileRow = typeof deploymentProfiles.$inferSelect;

export interface DeploymentProfileView {
  id: string;
  kind: DeploymentKind;
  name: string;
  description: string;
  region: string;
  identityMode: string;
  modelEndpointProfile: string;
  dataRetentionProfile: string;
  observabilityProfile: string;
  environment: string;
  version: string;
  implementedHere: boolean;
  outstandingWork: string[];
}

export const DEPLOYMENT_KIND_LABELS: Record<DeploymentKind, { en: string; de: string }> = {
  "dedicated-managed": {
    en: "Dedicated managed",
    de: "Dediziert betrieben",
  },
  "customer-managed-private": {
    en: "Customer managed private",
    de: "Kundenbetrieben, privat",
  },
  "bank-private-cloud": {
    en: "Bank private cloud",
    de: "Private Cloud der Bank",
  },
  "restricted-local-prototype": {
    en: "Restricted local prototype",
    de: "Eingeschraenkter lokaler Prototyp",
  },
};

/**
 * The honesty view of a profile.
 *
 * Two states only. A third state meaning "partly implemented" was considered
 * and rejected: in practice everything becomes partly implemented, and the
 * distinction a reader needs is whether they can run it today.
 */
export interface DeploymentHonesty {
  implementedHere: boolean;
  statusLabel: { en: string; de: string };
  statusTone: "success" | "neutral";
  /** One sentence a screen can print without adding a qualifier of its own. */
  claim: { en: string; de: string };
  outstandingWork: string[];
}

export function deploymentHonesty(profile: DeploymentProfileView): DeploymentHonesty {
  if (profile.implementedHere) {
    return {
      implementedHere: true,
      statusLabel: { en: "Implemented here", de: "Hier umgesetzt" },
      statusTone: "success",
      claim: {
        en: "This profile is what the running build does. Everything stated about it can be checked in this process.",
        de: "Dieses Profil entspricht dem laufenden Build. Alle Angaben dazu sind in diesem Prozess pruefbar.",
      },
      outstandingWork: [...profile.outstandingWork],
    };
  }
  return {
    implementedHere: false,
    statusLabel: { en: "Defined only", de: "Nur definiert" },
    statusTone: "neutral",
    claim: {
      en: "This profile is designed and documented. It is not implemented in this build, and the work below is what an engagement would still have to do.",
      de: "Dieses Profil ist entworfen und dokumentiert. Es ist in diesem Build nicht umgesetzt; die folgenden Punkte waeren in einem Projekt noch zu leisten.",
    },
    outstandingWork: [...profile.outstandingWork],
  };
}

export function buildDeploymentProfile(row: DeploymentProfileRow): DeploymentProfileView {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    description: row.description,
    region: row.region,
    identityMode: row.identityMode,
    modelEndpointProfile: row.modelEndpointProfile,
    dataRetentionProfile: row.dataRetentionProfile,
    observabilityProfile: row.observabilityProfile,
    environment: row.environment,
    version: row.version,
    implementedHere: row.implementedHere,
    outstandingWork: [...row.outstandingWork],
  };
}

/**
 * The profile used before the product tables are seeded.
 *
 * It describes the prototype, because that is what an unseeded clone is. A
 * fallback naming a managed service would be a claim the process cannot keep.
 */
export const FALLBACK_DEPLOYMENT_PROFILE: DeploymentProfileView = {
  id: "deployment-restricted-local",
  kind: "restricted-local-prototype",
  name: "Restricted local prototype",
  description:
    "One process on one machine, holding a synthetic institution in a local SQLite file.",
  region: "Local machine",
  identityMode: "No authentication. The acting role is scenario state, not an identity.",
  modelEndpointProfile: "Operator supplied endpoint, read from the environment at startup.",
  dataRetentionProfile: "Retained until the local database file is deleted or reset.",
  observabilityProfile: "Console logging with credential redaction. No external telemetry.",
  environment: "prototype",
  version: "0.0.0",
  implementedHere: true,
  outstandingWork: [],
};

const deploymentSlot = createConfigCacheSlot<DeploymentProfileView>();

/**
 * Resolves the active deployment profile.
 *
 * The organisation profile names it. The entitlement profile also carries a
 * `deploymentProfile` string, and where the two disagree the organisation
 * wins: entitlements describe what was licensed, the organisation describes
 * how this particular deployment is set up, and the second is the one an
 * operator can verify by looking at the machine.
 */
export function resolveDeploymentProfile(): DeploymentProfileView {
  return readThroughConfigCache(deploymentSlot, () => {
    const organisation = resolveOrganisationProfile();
    if (!organisation) return FALLBACK_DEPLOYMENT_PROFILE;
    try {
      const row = getDb()
        .select()
        .from(deploymentProfiles)
        .where(eq(deploymentProfiles.id, organisation.deploymentProfileId))
        .get();
      return row ? buildDeploymentProfile(row) : FALLBACK_DEPLOYMENT_PROFILE;
    } catch {
      return FALLBACK_DEPLOYMENT_PROFILE;
    }
  });
}

/** Every defined profile, implemented or not, for the deployment screen. */
export function listDeploymentProfiles(): DeploymentProfileView[] {
  try {
    return getDb()
      .select()
      .from(deploymentProfiles)
      .all()
      .map(buildDeploymentProfile)
      /*
       * Implemented first. The reader's first question is what runs today, and
       * putting the three designed profiles above it invites the assumption
       * that the list is a feature set.
       */
      .sort(
        (a, b) =>
          Number(b.implementedHere) - Number(a.implementedHere) || a.name.localeCompare(b.name),
      );
  } catch {
    return [];
  }
}
