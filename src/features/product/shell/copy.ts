/**
 * Copy shared by every Product Owner Console page.
 *
 * Section pages keep their own copy beside them; this holds only the words
 * the shell and more than one section use, so "In preparation" or "Acting as"
 * is the same phrase everywhere in the console. English and German, the
 * German in ASCII transliteration.
 */

export const CONSOLE_COPY = {
  eyebrow: { en: "Product owner console", de: "Product-Owner-Konsole" },
  railConsole: { en: "Console", de: "Konsole" },
  railDiscovery: { en: "Product discovery", de: "Produktentdeckung" },
  railDeepLinks: { en: "Existing pages", de: "Bestehende Seiten" },
  inPreparation: { en: "In preparation", de: "In Vorbereitung" },
  inPreparationDetail: {
    en: "This section is being built. Nothing is shown in its place, so no figure here can be mistaken for a measured one.",
    de: "Dieser Bereich wird gerade aufgebaut. An seiner Stelle wird nichts gezeigt, damit keine Zahl hier fuer eine gemessene gehalten werden kann.",
  },
  planSection: { en: "Plan section", de: "Planabschnitt" },
  existingPage: {
    en: "Part of this is already available on an existing page:",
    de: "Ein Teil davon ist bereits auf einer bestehenden Seite verfuegbar:",
  },
  open: { en: "Open", de: "Oeffnen" },
  viewAll: { en: "View all", de: "Alle anzeigen" },
  details: { en: "Details", de: "Details" },
} as const;
