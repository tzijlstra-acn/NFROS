/**
 * The not found page.
 *
 * There was none, so a missing route fell to the framework's own 404, and
 * that page is unstyled white. `globals.css` sets the body colour from
 * `--text-1`, which is near white because the root carries a dark theme, so
 * the result measured 1.07:1 against its own background: the words `404` and
 * `This page could not be found` were present and invisible. It also carried
 * no header and no main landmark, which made it the one genuine failure of
 * the requirement that a header renders on every route.
 *
 * It is deliberately plain and theme independent. A not found page cannot
 * assume it knows which interface version, role or theme the reader came
 * from, because the route it was reaching for did not resolve, so it states
 * its own colours rather than inheriting any.
 */

import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        padding: 32,
        background: "rgb(245 246 248)",
        color: "rgb(23 32 51)",
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
        textAlign: "center",
      }}
    >
      <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, letterSpacing: "-0.012em" }}>
        That page does not exist
      </h1>
      <p style={{ margin: 0, fontSize: 15, color: "rgb(84 95 118)", maxWidth: "48ch" }}>
        The address may be out of date, or the work you were looking for may have moved.
        Nothing has been lost.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 6, flexWrap: "wrap", justifyContent: "center" }}>
        <Link
          href="/workday"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 34,
            padding: "0 16px",
            borderRadius: 6,
            background: "rgb(79 70 229)",
            color: "rgb(255 255 255)",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Choose a role
        </Link>
        <Link
          href="/"
          style={{
            display: "inline-flex",
            alignItems: "center",
            height: 34,
            padding: "0 16px",
            borderRadius: 6,
            border: "1px solid rgb(214 219 228)",
            background: "rgb(255 255 255)",
            color: "rgb(23 32 51)",
            fontSize: 14,
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Start again
        </Link>
      </div>
      <span style={{ fontSize: 12, color: "rgb(122 132 153)", marginTop: 10 }}>
        Synthetic institution and data
      </span>
    </main>
  );
}
