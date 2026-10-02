import type { Language } from "@/i18n/labels";

const COPY = {
  soon: { en: "More coming soon", de: "In Kuerze verfuegbar" },
} as const;

const pick = (pair: { en: string; de: string }, language: Language) =>
  language === "de" ? pair.de : pair.en;

/**
 * A placeholder main-region page for V3.1 routes that are not yet fully
 * implemented. Renders within the V3 frame so the light theme is maintained
 * everywhere, even before each section has its own dedicated page.
 */
export function SectionStub({
  title,
  description,
  language,
}: {
  title: { en: string; de: string };
  description: { en: string; de: string };
  language: Language;
}) {
  return (
    <div style={{ maxWidth: 880, marginInline: "auto", paddingTop: "var(--wd-6)" }}>
      <h1 className="wd-page-title">{pick(title, language)}</h1>
      <p
        style={{
          marginTop: "var(--wd-2)",
          fontSize: "var(--wd-text-sm)",
          color: "var(--wd-text-secondary)",
        }}
      >
        {pick(description, language)}
      </p>
      <p
        style={{
          marginTop: "var(--wd-6)",
          fontSize: "var(--wd-text-sm)",
          color: "var(--wd-text-muted)",
        }}
      >
        {pick(COPY.soon, language)}
      </p>
      <span
        style={{
          display: "block",
          marginTop: "var(--wd-8)",
          fontSize: 12,
          color: "var(--wd-text-muted)",
        }}
      >
        Synthetic institution and data
      </span>
    </div>
  );
}
