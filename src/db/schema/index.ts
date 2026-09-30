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
