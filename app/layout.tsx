import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { getBrandIdentity } from "@/product";

/*
 * Typography is declared with plain @font-face in `src/styles/tokens.css`
 * against self hosted variable fonts in `public/fonts/`. The framework's
 * Google Font loader is deliberately not used: it resolves fonts at build
 * time, which makes a build depend on network access, and the application is
 * required to render with its intended typography in offline mode.
 */

/**
 * Resolved rather than literal.
 *
 * The product name, the institution and the icon all come from the product
 * configuration, so a second bank is onboarded by changing a row rather than
 * by editing this file. `getBrandIdentity` never throws and falls back to a
 * sensible default, which matters here because the document title is rendered
 * before the database is known to be seeded.
 *
 * `robots` stays closed. This is a prototype holding a synthetic institution
 * and it should not be indexed under any configuration.
 */
export async function generateMetadata(): Promise<Metadata> {
  const identity = getBrandIdentity();

  return {
    title: `${identity.productName}: Live the NFR Day`,
    description:
      "One work environment for non-financial risk. Specialist intelligence for every function. Human accountability at every material decision. Synthetic institution and data.",
    robots: { index: false, follow: false },
    ...(identity.faviconUrl ? { icons: { icon: identity.faviconUrl } } : {}),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e0f14",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        <div className="ambient" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
