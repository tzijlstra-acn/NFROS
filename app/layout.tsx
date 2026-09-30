import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";

/*
 * Typography is declared with plain @font-face in `src/styles/tokens.css`
 * against self hosted variable fonts in `public/fonts/`. The framework's
 * Google Font loader is deliberately not used: it resolves fonts at build
 * time, which makes a build depend on network access, and the application is
 * required to render with its intended typography in offline mode.
 */

export const metadata: Metadata = {
  title: "NFR WorkOS: Live the NFR Day",
  description:
    "One work environment for non-financial risk. Specialist intelligence for every function. Human accountability at every material decision. Synthetic institution and data.",
  robots: { index: false, follow: false },
};

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
