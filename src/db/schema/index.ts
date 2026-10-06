/**
 * Single import surface for the schema.
 *
 * Consumers should import from `@/db/schema` rather than from the individual
 * files, so table relocations do not ripple through the application.
 */

export * from "./core";
export * from "./domain";
export * from "./practice";
export * from "./work";
export * from "./decisions";
export * from "./product";
export * from "./integration";
export * from "./live";
export * from "./role-app-runtime";
export * from "./audit-chain";
export * from "./background-jobs";
export * from "./os-events";
export * from "./ai-partner";
export * from "./product-console";
export * from "./personalisation";
export * from "./process-inputs";
