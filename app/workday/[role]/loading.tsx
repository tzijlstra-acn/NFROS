/**
 * The workday loading state.
 *
 * It replaces the MAIN REGION only. The V3.1 header, navigation and bottom bar
 * come from `layout.tsx` and are already on screen, which is the property the
 * brief asks for: the header stays visible while the page route loads. Before
 * this file existed there was no boundary at all, so a route change showed
 * nothing until every query had resolved.
 *
 * It is styled with inline neutral values rather than the V3 tokens, and that
 * is deliberate rather than lazy. This boundary wraps the page segment for
 * EVERY interface version, because a loading file is chosen by the router and
 * cannot read which version was requested. A skeleton built from
 * `--wd-surface-hover` would resolve to nothing inside the V1 or V2 shells,
 * which do not carry the `.workday-v3` scope, and a light fill would flash
 * white inside their dark chrome. A translucent grey sits correctly on any
 * background.
 *
 * The dimensions match the content they stand in for, so nothing moves when
 * the real page arrives.
 */

const FILL = "rgb(128 128 128 / 14%)";

function Bar({ width, height = 13 }: { width: number | string; height?: number }) {
  return (
    <span
      aria-hidden="true"
      style={{
        display: "block",
        width,
        height,
        borderRadius: 4,
        background: FILL,
      }}
    />
  );
}

export default function WorkdayLoading() {
  return (
    <div style={{ padding: "20px 24px 40px", maxWidth: 1200 }} aria-busy="true">
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 }}>
        <Bar width={150} height={11} />
        <Bar width={300} height={22} />
      </div>

      {/*
        * The active item keeps its height. A card that grows from nothing to
        * 180px after the queue has already painted moves the whole page under
        * the reader, which is the layout shift the brief sets a budget on.
        */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "16px 20px",
          border: "1px solid rgb(128 128 128 / 18%)",
          borderLeft: "3px solid rgb(128 128 128 / 30%)",
          borderRadius: 8,
          minHeight: 150,
        }}
      >
        <Bar width="58%" height={20} />
        <Bar width="86%" />
        <Bar width={170} height={11} />
        <Bar width={132} height={32} />
      </div>

      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 8 }}>
        <Bar width={90} height={14} />
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              minHeight: 40,
              borderTop: row === 0 ? "none" : "1px solid rgb(128 128 128 / 14%)",
            }}
          >
            <Bar width={`${44 - row * 6}%`} />
            <span style={{ flex: 1 }} />
            <Bar width={60} height={11} />
          </div>
        ))}
      </div>

      {/*
        * Announced once, politely. The bars themselves are hidden from
        * assistive technology, because reading out four empty rows is noise.
        */}
      <span
        role="status"
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          overflow: "hidden",
          clipPath: "inset(50%)",
          whiteSpace: "nowrap",
        }}
      >
        Loading
      </span>
    </div>
  );
}
