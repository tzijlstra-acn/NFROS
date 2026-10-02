/**
 * Identity abstraction layer types.
 *
 * These types are shared across all product modes (demonstration, design-partner,
 * offline-evaluation) and must not pull in any runtime imports. They describe
 * the shape of a product session and the interface every identity provider
 * implements, regardless of how the session is established or stored.
 *
 * No auth library dependency, no real credentials. The session secret travels
 * only through environment variables and is never serialised here.
 */

export type ProductMode = "demonstration" | "design-partner" | "offline-evaluation";

export type ProductSession = {
  sessionId: string;
  userId: string;
  displayName: string;
  email?: string;
  organisationId: string;
  legalEntityIds: string[];
  roleIds: string[];
  authorityScopes: string[];
  isAdministrator: boolean;
  productMode: ProductMode;
  issuedAt: string;
  expiresAt: string;
};

export interface IdentityProvider {
  getSession(): Promise<ProductSession | null>;
  signIn(input?: unknown): Promise<ProductSession>;
  signOut(): Promise<void>;
}
