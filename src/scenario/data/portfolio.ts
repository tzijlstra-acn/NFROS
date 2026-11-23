/**
 * The portfolio register and its history, for NFR Workspace v3 analysis.
 *
 * Synthetic institution and data. No umlauts, no em dashes.
 *
 * The flagship day lives in the operational tables and is not touched here.
 * This module adds the breadth and the time that analysis needs, built so
 * that its patterns are deliberate and agree with the day:
 *
 *   A  Novalink (TP-0042) deteriorates from June 2026. Its monthly incident
 *      counts are the operational incident rows for August and September,
 *      and its assurance evidence goes stale after the 22.05.2026 DR test.
 *   B  Basalt Cloud Infrastructure B.V. sits under four critical third
 *      parties and two of the day's suppliers. A shared Basalt outage on
 *      19.08.2026 appears in every Basalt dependant's August incident count.
 *      Two Basalt dependants (Lumenwerk, Vireo) worsen from April 2026.
 *   C  The CTL-PAY cluster under P-007 and P-008 fails repeatedly in 2026.
 *      CTL-PAY-014 is still recorded fully effective while its own tests show
 *      minor exceptions in Q1 and Q2 and a disputed Q3 test.
 *   D  Digital banking (IBS-0001) recovered in 285 minutes against a 240
 *      minute tolerance in July, waiting on a Basalt object storage
 *      dependency that the service map does not hold.
 *   E  The risk acceptance register holds seven acceptances expiring within
 *      90 days of the scenario day, six of them on unmet conditions,
 *      including the RSK-0184 acceptance behind decision DEC-2026-0756.
 *
 * Deterministic: a fixed-seed generator, no wall clock, no Math.random. The
 * same run id always produces the same rows.
 */

/* ==========================================================================
   Calendar
   ========================================================================== */

/** 24 months, October 2024 to September 2026: the history the analysis reads. */
export const PORTFOLIO_MONTHS: readonly string[] = (() => {
  const months: string[] = [];
  for (let index = 0; index < 24; index += 1) {
    const year = 2024 + Math.floor((9 + index) / 12);
    const month = ((9 + index) % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
})();

/** Eight quarters, 2024-Q4 to 2026-Q3. */
export const PORTFOLIO_QUARTERS: readonly string[] = [
  "2024-Q4", "2025-Q1", "2025-Q2", "2025-Q3", "2025-Q4", "2026-Q1", "2026-Q2", "2026-Q3",
];

/** KRI history months before the operational 2026 series. */
const KRI_HISTORY_MONTHS = PORTFOLIO_MONTHS.filter((month) => month < "2026-01");

function monthEnd(period: string): string {
  const [year, month] = period.split("-").map(Number) as [number, number];
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${period}-${String(last).padStart(2, "0")}`;
}

function quarterOf(date: string): string {
  const [year, month] = date.split("-").map(Number) as [number, number];
  return `${year}-Q${Math.floor((month - 1) / 3) + 1}`;
}

function quarterEndDate(quarter: string): string {
  const [year, q] = [quarter.slice(0, 4), Number(quarter.slice(6))];
  return `${year}-${String(q * 3).padStart(2, "0")}-${q === 1 || q === 4 ? "31" : "30"}`;
}

/* ==========================================================================
   Deterministic generator
   ========================================================================== */

function generator(seedText: string): () => number {
  let seed = 2166136261;
  for (const char of seedText) seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/* ==========================================================================
   Providers
   ========================================================================== */

export interface ProviderDefinition {
  key: string;
  name: string;
  domicile: string;
}

/** Underlying providers. Keys are shared with the operational subprocessor names. */
export const PROVIDERS: Record<string, ProviderDefinition> = {
  basalt: { key: "basalt", name: "Basalt Cloud Infrastructure B.V.", domicile: "Amsterdam, Netherlands" },
  helvetia: { key: "helvetia", name: "Helvetia CloudWorks AG", domicile: "Zurich, Switzerland" },
  rheinstack: { key: "rheinstack", name: "Rheinstack GmbH", domicile: "Cologne, Germany" },
  stratos: { key: "stratos", name: "Stratos Cloud Services Ltd", domicile: "Dublin, Ireland" },
  nimbus: { key: "nimbus", name: "Nimbus Rechenzentrum GmbH", domicile: "Frankfurt am Main, Germany" },
  alpenrand: { key: "alpenrand", name: "Alpenrand Rechenzentrum AG", domicile: "Zug, Switzerland" },
};

/** Maps an operational subprocessor name to its provider key, when it is a shared provider. */
export function providerKeyForName(name: string): string {
  const lower = name.toLowerCase();
  for (const provider of Object.values(PROVIDERS)) {
    if (lower.startsWith(provider.name.toLowerCase().split(" ")[0] ?? "")) return provider.key;
  }
  return lower.replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ==========================================================================
   Register third parties
   ========================================================================== */

type Pattern = "stable" | "rising" | "improving" | "slight-rise" | "novalink";

interface RegisterEntry {
  id: string;
  name: string;
  domicile: string;
  category: string;
  criticality: "critical" | "important" | "standard";
  entityIds: string[];
  owner: string;
  spend: number;
  /** provider key, supported service, declared in the register submission. */
  links: Array<[string, string, boolean]>;
  pattern: Pattern;
  base: number;
  assurance: string;
  status?: string;
  description: string;
}

const REGISTER: readonly RegisterEntry[] = [
  { id: "TP-0119", name: "Seeland Clearing Services AG", domicile: "Bern, Switzerland", category: "payments", criticality: "critical", entityIds: ["ARC-CH"], owner: "P-002", spend: 2950000, links: [["helvetia", "IBS-0010", true]], pattern: "improving", base: 46, assurance: "2026-03-31", description: "Swiss franc clearing operations and SIC participant services for Arcadia Bank Schweiz." },
  { id: "TP-0131", name: "Lumenwerk Card Processing AG", domicile: "Vienna, Austria", category: "payments", criticality: "critical", entityIds: ["ARC-AT", "ARC-DE"], owner: "P-002", spend: 4410000, links: [["basalt", "IBS-0002", true]], pattern: "rising", base: 30, assurance: "2025-09-30", description: "Debit and credit card authorisation and processing for retail cards in Germany and Austria." },
  { id: "TP-0158", name: "Fernblick Digital Banking Platform GmbH", domicile: "Munich, Germany", category: "technology", criticality: "critical", entityIds: ["ARC-DE", "ARC-AT"], owner: "P-010", spend: 5320000, links: [["basalt", "IBS-0001", false]], pattern: "stable", base: 33, assurance: "2026-04-30", description: "Hosted digital banking platform, web and mobile, for retail clients." },
  { id: "TP-0172", name: "Vireo Identity Services SA", domicile: "Geneva, Switzerland", category: "data", criticality: "critical", entityIds: ["ARC-CH", "ARC-DE"], owner: "P-002", spend: 1880000, links: [["basalt", "IBS-0005", true]], pattern: "rising", base: 27, assurance: "2025-11-30", description: "Electronic identification, document verification and KYC data for client onboarding." },
  { id: "TP-0183", name: "Tessin Core Banking Services SA", domicile: "Lugano, Switzerland", category: "technology", criticality: "critical", entityIds: ["ARC-CH"], owner: "P-010", spend: 3640000, links: [["alpenrand", "IBS-0010", true]], pattern: "stable", base: 29, assurance: "2026-02-28", description: "Application management for the Swiss core banking platform." },
  { id: "TP-0195", name: "Kaltwasser Cash Logistik GmbH", domicile: "Hanover, Germany", category: "operations", criticality: "critical", entityIds: ["ARC-DE"], owner: "P-002", spend: 2270000, links: [], pattern: "stable", base: 24, assurance: "2026-01-31", description: "Cash-in-transit and ATM replenishment for the German branch network." },
  { id: "TP-0204", name: "Brennerpass Network Services GmbH", domicile: "Innsbruck, Austria", category: "telecom", criticality: "critical", entityIds: ["ARC-DE", "ARC-AT", "ARC-CH"], owner: "P-010", spend: 2860000, links: [["nimbus", "IBS-0004", true], ["nimbus", "IBS-0002", true]], pattern: "slight-rise", base: 31, assurance: "2025-12-31", description: "Wide area network and payment network connectivity across the group." },
  { id: "TP-0216", name: "Oberland SOC Services GmbH", domicile: "Stuttgart, Germany", category: "cyber", criticality: "critical", entityIds: ["ARC-DE", "ARC-AT", "ARC-CH"], owner: "P-010", spend: 1990000, links: [["stratos", "IBS-0008", true]], pattern: "stable", base: 26, assurance: "2026-05-31", description: "Managed security operations centre and incident response retainer." },
  { id: "TP-0146", name: "Aquila Market Data GmbH", domicile: "Frankfurt am Main, Germany", category: "data", criticality: "important", entityIds: ["ARC-DE"], owner: "P-010", spend: 1320000, links: [["stratos", "IBS-0006", true]], pattern: "stable", base: 22, assurance: "2026-02-28", description: "Market data feeds and reference rates for treasury and liquidity management." },
  { id: "TP-0233", name: "Rotmain Dokumentenarchiv GmbH", domicile: "Wuerzburg, Germany", category: "records", criticality: "important", entityIds: ["ARC-DE"], owner: "P-002", spend: 640000, links: [["nimbus", "IBS-0009", true]], pattern: "stable", base: 25, assurance: "2025-10-31", description: "Long-term archive for client correspondence and statements." },
  { id: "TP-0241", name: "Isarblick Analytics GmbH", domicile: "Munich, Germany", category: "data", criticality: "important", entityIds: ["ARC-DE", "ARC-AT"], owner: "P-010", spend: 870000, links: [["stratos", "IBS-0008", true]], pattern: "stable", base: 21, assurance: "2026-03-31", description: "Risk data aggregation and reporting analytics platform." },
  { id: "TP-0264", name: "Saale Kundenservice GmbH", domicile: "Halle, Germany", category: "operations", criticality: "important", entityIds: ["ARC-DE"], owner: "P-002", spend: 1460000, links: [], pattern: "slight-rise", base: 34, assurance: "2025-08-31", description: "Overflow contact centre for retail clients." },
  { id: "TP-0271", name: "Zugspitz Treasury Systems AG", domicile: "Garmisch-Partenkirchen, Germany", category: "technology", criticality: "important", entityIds: ["ARC-DE", "ARC-CH"], owner: "P-010", spend: 1150000, links: [["stratos", "IBS-0006", true]], pattern: "stable", base: 23, assurance: "2026-01-31", description: "Treasury management system, hosted." },
  { id: "TP-0283", name: "Bodensee Trade Finance Services GmbH", domicile: "Konstanz, Germany", category: "operations", criticality: "important", entityIds: ["ARC-DE", "ARC-CH"], owner: "P-002", spend: 930000, links: [["nimbus", "IBS-0003", true]], pattern: "stable", base: 28, assurance: "2025-12-31", description: "Documentary trade finance processing for corporate clients." },
  { id: "TP-0290", name: "Alster Sanctions Analytics GmbH", domicile: "Hamburg, Germany", category: "data", criticality: "important", entityIds: ["ARC-DE", "ARC-AT"], owner: "P-002", spend: 760000, links: [["stratos", "IBS-0007", true]], pattern: "stable", base: 24, assurance: "2026-04-30", description: "Name screening tuning and sanctions list analytics." },
  { id: "TP-0322", name: "Murtal IT Service Desk GmbH", domicile: "Graz, Austria", category: "technology", criticality: "important", entityIds: ["ARC-AT", "ARC-DE"], owner: "P-010", spend: 1080000, links: [["nimbus", "IBS-0001", true]], pattern: "stable", base: 27, assurance: "2025-11-30", description: "First and second level IT service desk." },
  { id: "TP-0356", name: "Hochrhein Loan Servicing AG", domicile: "Schaffhausen, Switzerland", category: "operations", criticality: "important", entityIds: ["ARC-CH"], owner: "P-002", spend: 1240000, links: [["helvetia", "IBS-0003", true]], pattern: "slight-rise", base: 30, assurance: "2025-07-31", description: "Mortgage and lending servicing for Arcadia Bank Schweiz." },
  { id: "TP-0368", name: "Weinviertel Data Centre GmbH", domicile: "Vienna, Austria", category: "cloud", criticality: "important", entityIds: ["ARC-AT"], owner: "P-010", spend: 1710000, links: [], pattern: "stable", base: 22, assurance: "2026-03-31", description: "Colocation data centre for Arcadia Bank Oesterreich." },
  { id: "TP-0375", name: "Spree Card Embossing GmbH", domicile: "Berlin, Germany", category: "operations", criticality: "important", entityIds: ["ARC-DE", "ARC-AT"], owner: "P-002", spend: 560000, links: [], pattern: "stable", base: 20, assurance: "2025-10-31", description: "Card production, embossing and secure mailing." },
  { id: "TP-0397", name: "Rhoen Market Surveillance GmbH", domicile: "Fulda, Germany", category: "data", criticality: "important", entityIds: ["ARC-DE"], owner: "P-002", spend: 690000, links: [["stratos", "IBS-0007", true]], pattern: "stable", base: 21, assurance: "2026-02-28", description: "Trade and market abuse surveillance platform." },
  { id: "TP-0227", name: "Wiesental Payroll Systems GmbH", domicile: "Freiburg, Germany", category: "people", criticality: "standard", entityIds: ["ARC-DE"], owner: "P-002", spend: 410000, links: [], pattern: "stable", base: 18, assurance: "2025-12-31", description: "Payroll processing for German employees." },
  { id: "TP-0252", name: "Ammersee Print und Versand GmbH", domicile: "Augsburg, Germany", category: "operations", criticality: "standard", entityIds: ["ARC-DE"], owner: "P-002", spend: 380000, links: [], pattern: "stable", base: 19, assurance: "2025-06-30", description: "Overflow print and mail for client correspondence." },
  { id: "TP-0302", name: "Pfalz Facility Services GmbH", domicile: "Mannheim, Germany", category: "facilities", criticality: "standard", entityIds: ["ARC-DE"], owner: "P-002", spend: 1620000, links: [], pattern: "stable", base: 16, assurance: "2025-09-30", description: "Facility management for German offices." },
  { id: "TP-0315", name: "Havelufer Rechtsanwaelte PartG", domicile: "Potsdam, Germany", category: "professional", criticality: "standard", entityIds: ["ARC-DE"], owner: "P-016", spend: 520000, links: [], pattern: "stable", base: 14, assurance: "2025-12-31", description: "External legal counsel, outsourcing and contract law." },
  { id: "TP-0334", name: "Taunus Cyber Assurance GmbH", domicile: "Wiesbaden, Germany", category: "cyber", criticality: "standard", entityIds: ["ARC-DE", "ARC-AT", "ARC-CH"], owner: "P-010", spend: 450000, links: [], pattern: "stable", base: 15, assurance: "2026-01-31", description: "Penetration testing and red team engagements." },
  { id: "TP-0341", name: "Elbtal Inkasso GmbH", domicile: "Dresden, Germany", category: "operations", criticality: "standard", entityIds: ["ARC-DE"], owner: "P-002", spend: 290000, links: [], pattern: "stable", base: 23, assurance: "2025-05-31", status: "under-review", description: "Debt collection for retail lending." },
  { id: "TP-0389", name: "Allgaeu Sprachdienste GmbH", domicile: "Kempten, Germany", category: "professional", criticality: "standard", entityIds: ["ARC-DE", "ARC-AT", "ARC-CH"], owner: "P-002", spend: 170000, links: [], pattern: "stable", base: 12, assurance: "2025-11-30", description: "Translation of client and regulatory documents." },
];

/** The operational suppliers with a history in the register, and how each moves. */
const OPERATIONAL_HISTORY: Record<string, { pattern: Pattern; base: number; basalt: boolean; assurance: string }> = {
  "TP-0042": { pattern: "novalink", base: 34, basalt: false, assurance: "2026-05-22" },
  "TP-0015": { pattern: "stable", base: 31, basalt: true, assurance: "2026-01-31" },
  "TP-0007": { pattern: "stable", base: 26, basalt: true, assurance: "2026-03-31" },
  "TP-0023": { pattern: "improving", base: 44, basalt: false, assurance: "2026-04-30" },
  "TP-0058": { pattern: "slight-rise", base: 33, basalt: false, assurance: "2025-12-31" },
  "TP-0071": { pattern: "rising", base: 36, basalt: false, assurance: "2025-03-31" },
  "TP-0093": { pattern: "stable", base: 21, basalt: false, assurance: "2025-10-31" },
};

/* ==========================================================================
   Monthly metrics
   ========================================================================== */

/** Novalink, authored: rises from June 2026, incidents match the operational rows. */
const NOVALINK_SCORE: Record<string, number> = {
  "2026-04": 36, "2026-05": 39, "2026-06": 45, "2026-07": 51, "2026-08": 62, "2026-09": 76,
};
const NOVALINK_INCIDENTS: Record<string, number> = { "2025-02": 1, "2025-11": 1, "2026-03": 1, "2026-08": 1, "2026-09": 5 };

function trend(pattern: Pattern, index: number): number {
  /* index 0 = 2024-10, 18 = 2026-04, 23 = 2026-09 */
  switch (pattern) {
    case "rising":
      return index < 18 ? 0 : (index - 17) * 5.2;
    case "slight-rise":
      return index < 14 ? 0 : (index - 13) * 1.3;
    case "improving":
      return index < 10 ? 0 : -(index - 9) * 1.15;
    default:
      return 0;
  }
}

function assuranceFor(reportDate: string, period: string): string {
  const [ry, rm] = reportDate.split("-").map(Number) as [number, number];
  const [py, pm] = period.split("-").map(Number) as [number, number];
  let age = (py - ry) * 12 + (pm - rm);
  /* Before the latest report, the previous annual report was the one on file. */
  while (age < 0) age += 12;
  if (age <= 12) return "current";
  if (age <= 15) return "aging";
  return "stale";
}

export type MonthlyMetricRow = {
  id: string;
  runId: string;
  thirdPartyId: string;
  period: string;
  availabilityPct: number;
  slaBreaches: number;
  incidents: number;
  riskScore: number;
  assuranceStatus: string;
}

const BASALT_OUTAGE_MONTH = "2026-08";

function monthlyMetrics(
  runId: string,
  thirdPartyId: string,
  spec: { pattern: Pattern; base: number; basalt: boolean; assurance: string },
): MonthlyMetricRow[] {
  const random = generator(`metrics:${thirdPartyId}`);
  return PORTFOLIO_MONTHS.map((period, index) => {
    const noise = (random() - 0.5) * 4;
    let score =
      spec.pattern === "novalink"
        ? NOVALINK_SCORE[period] ?? spec.base + noise * 0.6
        : spec.base + trend(spec.pattern, index) + noise;
    let incidents: number;
    if (spec.pattern === "novalink") {
      incidents = NOVALINK_INCIDENTS[period] ?? 0;
    } else {
      const pressure = clamp((score - 30) / 40, 0, 1);
      const draw = random();
      incidents = draw < 0.06 + pressure * 0.5 ? 1 : 0;
      if (score > 55 && draw < 0.35) incidents += 1;
      if (score > 62 && draw < 0.25) incidents += 1;
    }
    if (spec.basalt && period === BASALT_OUTAGE_MONTH) {
      incidents += 1;
      score += 7;
    }
    if (spec.basalt && period === "2026-09") score += 3;
    score = Math.round(clamp(score, 5, 95));
    const slaBreaches = Math.max(0, incidents - 1) + (score > 50 && random() < 0.5 ? 1 : 0);
    const availability = clamp(99.99 - score * 0.0035 - incidents * 0.06 - random() * 0.01, 99.2, 99.99);
    return {
      id: `TPM-${thirdPartyId}-${period}`,
      runId,
      thirdPartyId,
      period,
      availabilityPct: round2(availability),
      slaBreaches,
      incidents,
      riskScore: score,
      assuranceStatus:
        thirdPartyId === "TP-0042" && period >= "2026-07" ? "stale" : assuranceFor(spec.assurance, period),
    };
  });
}

/* ==========================================================================
   Control test results
   ========================================================================== */

export interface OperationalControl {
  id: string;
  currentEffectiveness: string;
  isKeyControl: boolean;
  lastTestedOn: string | null;
}

type Result = "effective" | "minor-exceptions" | "failed" | "awaiting-conclusion" | "not-tested";

/** Authored sequences, 2024-Q4 to 2026-Q3. A dot means "use the generated value". */
const AUTHORED_RESULTS: Record<string, Array<[Result, number] | null>> = {
  "CTL-PAY-014": [["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["minor-exceptions", 2], ["awaiting-conclusion", 4]],
  "CTL-PAY-006": [["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["effective", 0], ["minor-exceptions", 1], ["failed", 3], ["failed", 4], ["failed", 5]],
  "CTL-PAY-031": [["effective", 0], ["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["minor-exceptions", 2], ["failed", 3], ["minor-exceptions", 2], ["failed", 4]],
  "CTL-PAY-034": [["effective", 0], ["minor-exceptions", 1], ["effective", 0], ["minor-exceptions", 1], ["failed", 2], ["failed", 3], ["not-tested", 0], ["not-tested", 0]],
  "CTL-PAY-037": [["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["effective", 0], ["minor-exceptions", 1], ["failed", 2], ["failed", 3], ["not-tested", 0]],
  "CTL-PAY-041": [["effective", 0], ["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["minor-exceptions", 1], ["failed", 2], ["failed", 3], ["not-tested", 0]],
  "CTL-PAY-044": [["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["minor-exceptions", 2], ["failed", 3], ["not-tested", 0]],
  "CTL-PAY-029": [["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["not-tested", 0]],
  "CTL-PAY-021": [["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["effective", 0], ["minor-exceptions", 1], ["not-tested", 0]],
  "CTL-TPR-006": [["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["effective", 0], ["minor-exceptions", 2], ["minor-exceptions", 2], ["minor-exceptions", 2], ["awaiting-conclusion", 3]],
  "CTL-RES-003": [["effective", 0], ["minor-exceptions", 1], ["effective", 0], ["minor-exceptions", 1], ["minor-exceptions", 1], ["failed", 2], ["failed", 2], ["failed", 2]],
  "CTL-GOV-009": [["effective", 0], ["effective", 0], ["effective", 0], ["minor-exceptions", 1], ["effective", 0], ["minor-exceptions", 1], ["minor-exceptions", 1], ["minor-exceptions", 2]],
  "CTL-REG-004": [["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0], ["effective", 0]],
};

/** The operational test behind a quarter, where one exists. */
const OPERATIONAL_TEST: Record<string, [string, string]> = {
  "CTL-PAY-014": ["2026-Q3", "TST-2026-0318"],
  "CTL-PAY-029": ["2026-Q2", "TST-2026-0281"],
  "CTL-TPR-006": ["2026-Q3", "TST-2026-0294"],
  "CTL-RES-003": ["2026-Q3", "TST-2026-0302"],
  "CTL-GOV-009": ["2026-Q3", "TST-2026-0311"],
  "CTL-REG-004": ["2026-Q3", "TST-2026-0325"],
};

function generatedResult(control: OperationalControl, index: number, random: () => number): [Result, number] {
  const late = index >= 5;
  const draw = random();
  switch (control.currentEffectiveness) {
    case "fully-effective":
      return ["effective", 0];
    case "largely-effective":
      return draw < (late ? 0.28 : 0.14) ? ["minor-exceptions", 1] : ["effective", 0];
    case "partially-effective":
      if (late) return draw < 0.45 ? ["failed", 2 + Math.floor(random() * 2)] : ["minor-exceptions", 1 + Math.floor(random() * 2)];
      return draw < 0.3 ? ["minor-exceptions", 1] : ["effective", 0];
    case "not-effective":
      if (index >= 6) return ["failed", 2 + Math.floor(random() * 3)];
      return draw < 0.4 ? ["minor-exceptions", 1] : ["effective", 0];
    default:
      return ["effective", 0];
  }
}

export type ControlTestResultRow = {
  id: string;
  runId: string;
  controlId: string;
  period: string;
  result: string;
  exceptions: number;
  sampleSize: number;
  testedOn: string | null;
  controlTestId: string | null;
}

function controlResults(runId: string, control: OperationalControl): ControlTestResultRow[] {
  const random = generator(`controls:${control.id}`);
  const lastQuarter = control.lastTestedOn ? quarterOf(control.lastTestedOn) : null;
  const authored = AUTHORED_RESULTS[control.id];
  return PORTFOLIO_QUARTERS.map((period, index) => {
    const sampleSize = control.isKeyControl ? 25 : 15;
    let entry: [Result, number];
    const fixed = authored?.[index];
    if (fixed) entry = fixed;
    else if (lastQuarter === null || period > lastQuarter) entry = ["not-tested", 0];
    else if (!control.isKeyControl && index % 2 === 0) entry = ["not-tested", 0];
    else entry = generatedResult(control, index, random);
    const operational = OPERATIONAL_TEST[control.id];
    const linked = operational && operational[0] === period ? operational[1] : null;
    const testedOn =
      entry[0] === "not-tested"
        ? null
        : period === lastQuarter && control.lastTestedOn
          ? control.lastTestedOn
          : quarterEndDate(period);
    return {
      id: `CTR-${control.id}-${period}`,
      runId,
      controlId: control.id,
      period,
      result: entry[0],
      exceptions: entry[1],
      sampleSize: linked === "TST-2026-0318" ? 60 : linked === "TST-2026-0281" ? 24 : sampleSize,
      testedOn,
      controlTestId: linked,
    };
  });
}

/* ==========================================================================
   KRI history
   ========================================================================== */

export interface OperationalKri {
  id: string;
  adverseDirection: string;
  amberThreshold: number;
  redThreshold: number;
  /** The first 2026 reading, which the history leads into. */
  firstValue: number;
}

/** Where each KRI starts in October 2024. The series moves from here to January 2026. */
const KRI_START: Record<string, number> = {
  "KRI-PAY-007": 2.2, "KRI-PAY-003": 1.62, "KRI-PAY-011": 100, "KRI-PAY-016": 0, "KRI-PAY-022": 0.44,
  "KRI-TPR-002": 99.1, "KRI-RES-005": 93, "KRI-GOV-001": 2, "KRI-GOV-004": 99.4,
};

export function kriStatus(kri: Pick<OperationalKri, "adverseDirection" | "amberThreshold" | "redThreshold">, value: number): string {
  if (kri.adverseDirection === "down") {
    if (value < kri.redThreshold) return "red";
    if (value < kri.amberThreshold) return "amber";
    return "green";
  }
  if (value > kri.redThreshold) return "red";
  if (value > kri.amberThreshold) return "amber";
  return "green";
}

export type KriHistoryRow = {
  id: string;
  runId: string;
  kriId: string;
  period: string;
  periodEnd: string;
  value: number;
  status: string;
}

function kriHistoryRows(runId: string, kri: OperationalKri): KriHistoryRow[] {
  const random = generator(`kri:${kri.id}`);
  const start = KRI_START[kri.id] ?? kri.firstValue;
  const steps = KRI_HISTORY_MONTHS.length;
  const integer = kri.id === "KRI-PAY-016" || kri.id === "KRI-GOV-001";
  return KRI_HISTORY_MONTHS.map((period, index) => {
    const progress = (index + 1) / (steps + 1);
    let value = start + (kri.firstValue - start) * progress;
    const span = Math.abs(kri.redThreshold - kri.amberThreshold) || 1;
    value += (random() - 0.5) * span * 0.18;
    /* KRI-PAY-007 was last red in July 2025: the September 2026 breach is the first in 14 months. */
    if (kri.id === "KRI-PAY-007") value = period === "2025-07" ? 3.62 : Math.min(value, 2.46);
    if (kri.id === "KRI-PAY-011") value = 100;
    if (integer) value = Math.max(0, Math.round(value + (random() < 0.2 ? 1 : 0)));
    if (kri.id === "KRI-PAY-016") value = Math.min(value, 1);
    value = integer ? value : kri.id.startsWith("KRI-PAY-00") || kri.id === "KRI-PAY-022" ? round2(value) : round1(value);
    /* Keep the pre-2026 history clear of red except where the story says otherwise. */
    let status = kriStatus(kri, value);
    if (status === "red" && kri.id !== "KRI-PAY-007") {
      value = kri.adverseDirection === "down" ? round1(kri.redThreshold + span * 0.3) : round2(kri.redThreshold - span * 0.3);
      status = kriStatus(kri, value);
    }
    return { id: `KRH-${kri.id}-${period}`, runId, kriId: kri.id, period, periodEnd: monthEnd(period), value, status };
  });
}

/* ==========================================================================
   Risk acceptances
   ========================================================================== */

export type RiskAcceptanceRow = {
  id: string;
  runId: string;
  reference: string;
  riskId: string;
  subjectKind: string;
  subjectId: string;
  subjectLabel: string;
  entityId: string;
  title: string;
  rationale: string;
  conditions: string;
  conditionsMet: boolean;
  grantedOn: string;
  expiresOn: string;
  ownerUserId: string;
  approverUserId: string;
  status: string;
  evidenceDocumentId: string | null;
  issueId: string | null;
}

const ACCEPTANCES: ReadonlyArray<Omit<RiskAcceptanceRow, "id" | "runId">> = [
  { reference: "RA-2026-001", riskId: "RSK-0184", subjectKind: "supplier", subjectId: "TP-0042", subjectLabel: "Novalink Payment Services GmbH", entityId: "ARC-DE", title: "Concentration on Novalink for corporate payment repair and clearing", rationale: "No substitute can be onboarded inside 12 months; the residual risk is accepted while the exit capability is built.", conditions: "Contracted two hour recovery objective evidenced each quarter; exit test planned and started by 30.09.2026.", conditionsMet: false, grantedOn: "2026-01-19", expiresOn: "2026-12-31", ownerUserId: "P-007", approverUserId: "P-013", status: "active", evidenceDocumentId: "EVD-2026-41204", issueId: "ISS-2026-0301" },
  { reference: "RA-2026-004", riskId: "RSK-0371", subjectKind: "process", subjectId: "PRC-0041", subjectLabel: "Payment repair and manual override", entityId: "ARC-DE", title: "Secondary reviewer establishment below the approved level", rationale: "Recruitment for two reviewer positions is under way; interim cover by team leads.", conditions: "Establishment restored to 95 percent by 30.09.2026.", conditionsMet: false, grantedOn: "2026-04-30", expiresOn: "2026-10-31", ownerUserId: "P-007", approverUserId: "P-014", status: "active", evidenceDocumentId: null, issueId: "ISS-2026-0305" },
  { reference: "RA-2026-009", riskId: "RSK-0186", subjectKind: "supplier", subjectId: "TP-0042", subjectLabel: "Novalink Payment Services GmbH", entityId: "ARC-DE", title: "Exit plan for Novalink not yet executable", rationale: "The exit plan is accepted as a design while the internal repair capability is specified.", conditions: "Exit plan tested end to end by 30.09.2026.", conditionsMet: false, grantedOn: "2026-03-02", expiresOn: "2026-11-30", ownerUserId: "P-002", approverUserId: "P-013", status: "active", evidenceDocumentId: "EVD-2026-41440", issueId: "ISS-2026-0277" },
  { reference: "RA-2026-012", riskId: "RSK-0302", subjectKind: "service", subjectId: "IBS-0004", subjectLabel: "Corporate Payments", entityId: "ARC-DE", title: "Corporate payments fallback arrangement untested", rationale: "The fallback route is contracted; a live test needs a clearing window agreed with the scheme.", conditions: "Fallback tested in a live window before 15.12.2026.", conditionsMet: false, grantedOn: "2026-06-15", expiresOn: "2026-12-15", ownerUserId: "P-005", approverUserId: "P-013", status: "active", evidenceDocumentId: null, issueId: "ISS-2026-0288" },
  { reference: "RA-2026-015", riskId: "RSK-0185", subjectKind: "supplier", subjectId: "TP-0042", subjectLabel: "Novalink Payment Services GmbH", entityId: "ARC-DE", title: "Subprocessor register reconciliation for Novalink incomplete", rationale: "Reconciliation depends on the contract appendix renegotiation.", conditions: "Appendix renegotiated and register reconciled.", conditionsMet: false, grantedOn: "2026-03-31", expiresOn: "2027-03-31", ownerUserId: "P-002", approverUserId: "P-001", status: "active", evidenceDocumentId: null, issueId: "ISS-2026-0298" },
  { reference: "RA-2026-018", riskId: "RSK-0301", subjectKind: "service", subjectId: "IBS-0001", subjectLabel: "Retail Account Servicing and Digital Banking", entityId: "ARC-DE", title: "Digital banking recovery exceeds its impact tolerance", rationale: "Platform failover redesign is scheduled with the supplier for Q1 2027.", conditions: "Basalt object storage failover added to the service map and tested.", conditionsMet: false, grantedOn: "2026-08-20", expiresOn: "2026-11-20", ownerUserId: "P-005", approverUserId: "P-014", status: "active", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2026-021", riskId: "RSK-0262", subjectKind: "control", subjectId: "CTL-GOV-021", subjectLabel: "Retention and retrievability of key control evidence", entityId: "ARC-DE", title: "Evidence retrieval gaps on key controls", rationale: "Archive migration completes in Q1 2027.", conditions: "Monthly retrieval sampling at 98 percent or better.", conditionsMet: true, grantedOn: "2026-02-28", expiresOn: "2027-02-28", ownerUserId: "P-004", approverUserId: "P-001", status: "active", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2026-002", riskId: "RSK-0216", subjectKind: "process", subjectId: "PRC-0046", subjectLabel: "Swiss franc and euroSIC clearing submission", entityId: "ARC-CH", title: "Swiss clearing cut-off exposure during migration", rationale: "Accepted for the clearing adapter migration window.", conditions: "Migration complete by 30.09.2026.", conditionsMet: false, grantedOn: "2026-03-31", expiresOn: "2026-09-30", ownerUserId: "P-015", approverUserId: "P-005", status: "renewal-requested", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2025-044", riskId: "RSK-0331", subjectKind: "process", subjectId: "PRC-0082", subjectLabel: "Remediation action management", entityId: "ARC-DE", title: "Remediation extensions above the policy limit", rationale: "Committee approved extensions for legacy actions.", conditions: "Quarterly reporting of every extended action to the committee.", conditionsMet: true, grantedOn: "2025-12-15", expiresOn: "2027-06-30", ownerUserId: "P-001", approverUserId: "P-014", status: "active", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2026-024", riskId: "RSK-0213", subjectKind: "process", subjectId: "PRC-0042", subjectLabel: "Payment instruction intake and validation", entityId: "ARC-DE", title: "Manual completion of cross-border reporting fields", rationale: "Data model change scheduled for the 2027 release.", conditions: "Daily completeness check evidenced.", conditionsMet: true, grantedOn: "2026-01-31", expiresOn: "2027-01-31", ownerUserId: "P-007", approverUserId: "P-001", status: "active", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2026-027", riskId: "RSK-0261", subjectKind: "supplier", subjectId: "TP-0042", subjectLabel: "Novalink Payment Services GmbH", entityId: "ARC-DE", title: "Supplier change notifications reviewed after deployment", rationale: "Pre-deployment review requires a contract change.", conditions: "Every Novalink release note reviewed within five days.", conditionsMet: false, grantedOn: "2026-06-20", expiresOn: "2026-12-20", ownerUserId: "P-002", approverUserId: "P-001", status: "active", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2025-038", riskId: "RSK-0215", subjectKind: "process", subjectId: "PRC-0045", subjectLabel: "Corporate payment static data maintenance", entityId: "ARC-DE", title: "Static data dual control on legacy channel", rationale: "Legacy channel retires in 2027.", conditions: "Monthly sample review.", conditionsMet: true, grantedOn: "2025-10-30", expiresOn: "2027-04-30", ownerUserId: "P-007", approverUserId: "P-001", status: "active", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2026-030", riskId: "RSK-0184", subjectKind: "supplier", subjectId: "TP-0131", subjectLabel: "Lumenwerk Card Processing AG", entityId: "ARC-AT", title: "Single card processor for Austrian retail cards", rationale: "A second processor is contracted for 2027.", conditions: "Quarterly availability above 99.9 percent.", conditionsMet: true, grantedOn: "2026-01-02", expiresOn: "2027-01-02", ownerUserId: "P-002", approverUserId: "P-013", status: "active", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2026-033", riskId: "RSK-0351", subjectKind: "process", subjectId: "PRC-0071", subjectLabel: "Regulatory change identification and impact assessment", entityId: "ARC-DE", title: "Manual horizon scanning for Swiss publications", rationale: "Tool coverage for FINMA publications follows in 2027.", conditions: "Weekly manual scan evidenced.", conditionsMet: true, grantedOn: "2026-05-31", expiresOn: "2027-05-31", ownerUserId: "P-006", approverUserId: "P-001", status: "active", evidenceDocumentId: null, issueId: null },
  { reference: "RA-2025-040", riskId: "RSK-0212", subjectKind: "process", subjectId: "PRC-0043", subjectLabel: "Clearing submission and route management", entityId: "ARC-DE", title: "Manual route substitution approvals", rationale: "Accepted until automated route substitution went live.", conditions: "Automated substitution live by 31.08.2026.", conditionsMet: false, grantedOn: "2025-08-31", expiresOn: "2026-08-31", ownerUserId: "P-007", approverUserId: "P-013", status: "expired", evidenceDocumentId: null, issueId: null },
];

/* ==========================================================================
   Service resilience
   ========================================================================== */

export type ServiceResilienceRow = {
  id: string;
  runId: string;
  serviceId: string;
  entityId: string;
  reference: string;
  source: string;
  testedOn: string;
  scenario: string;
  toleranceMinutes: number;
  observedMinutes: number;
  finding: string;
  unmappedDependency: string | null;
  openActions: number;
}

const RESILIENCE: ReadonlyArray<Omit<ServiceResilienceRow, "id" | "runId">> = [
  { serviceId: "IBS-0001", entityId: "ARC-DE", reference: "EX-2026-07", source: "exercise", testedOn: "2026-07-14", scenario: "Loss of the primary hosting region of the digital banking platform", toleranceMinutes: 240, observedMinutes: 285, finding: "Failover waited 70 minutes on object storage in a second region that the platform supplier had not declared.", unmappedDependency: "Basalt Cloud object storage, through Fernblick Digital Banking Platform", openActions: 2 },
  { serviceId: "IBS-0002", entityId: "ARC-DE", reference: "EX-2026-04", source: "exercise", testedOn: "2026-04-22", scenario: "Card processor authorisation outage during peak trading", toleranceMinutes: 180, observedMinutes: 155, finding: "Stand-in processing held; recovery inside tolerance with 25 minutes to spare.", unmappedDependency: null, openActions: 0 },
  { serviceId: "IBS-0003", entityId: "ARC-DE", reference: "EX-2026-03", source: "exercise", testedOn: "2026-03-11", scenario: "Loan servicing platform unavailable for one business day", toleranceMinutes: 1440, observedMinutes: 610, finding: "Manual drawdown procedure executed as documented.", unmappedDependency: null, openActions: 0 },
  { serviceId: "IBS-0004", entityId: "ARC-DE", reference: "EX-2026-05", source: "exercise", testedOn: "2026-05-22", scenario: "Novalink RepairDesk and NOVA-GATE disaster recovery", toleranceMinutes: 240, observedMinutes: 220, finding: "Inside the service tolerance, but RepairDesk recovered in 3 hours 40 minutes against a contracted 2 hour objective.", unmappedDependency: null, openActions: 1 },
  { serviceId: "IBS-0004", entityId: "ARC-CH", reference: "INC-2026-0388", source: "live-event", testedOn: "2026-09-25", scenario: "NOVA-GATE latency with euroSIC queueing", toleranceMinutes: 120, observedMinutes: 96, finding: "Swiss submission completed before the cut-off with 24 minutes of tolerance left.", unmappedDependency: null, openActions: 1 },
  { serviceId: "IBS-0005", entityId: "ARC-DE", reference: "EX-2026-06", source: "exercise", testedOn: "2026-06-09", scenario: "Identity verification provider unavailable", toleranceMinutes: 480, observedMinutes: 300, finding: "Onboarding queued and released after recovery.", unmappedDependency: null, openActions: 0 },
  { serviceId: "IBS-0006", entityId: "ARC-DE", reference: "EX-2026-02", source: "exercise", testedOn: "2026-02-17", scenario: "Market data feed loss at liquidity cut-off", toleranceMinutes: 120, observedMinutes: 75, finding: "Secondary feed took over automatically.", unmappedDependency: null, openActions: 0 },
  { serviceId: "IBS-0007", entityId: "ARC-DE", reference: "EX-2026-01", source: "exercise", testedOn: "2026-03-18", scenario: "Screening provider regional outage", toleranceMinutes: 240, observedMinutes: 262, finding: "Recovery exceeded tolerance by 22 minutes; the gap was not escalated.", unmappedDependency: null, openActions: 1 },
  { serviceId: "IBS-0010", entityId: "ARC-CH", reference: "EX-2026-08", source: "exercise", testedOn: "2026-05-27", scenario: "Swiss core banking data centre switch", toleranceMinutes: 240, observedMinutes: 180, finding: "Switch completed with one manual reconciliation step.", unmappedDependency: null, openActions: 0 },
];

/* ==========================================================================
   Assembly
   ========================================================================== */

export interface PortfolioInput {
  controls: readonly OperationalControl[];
  kris: readonly OperationalKri[];
}

export function buildPortfolio(runId: string, input: PortfolioInput) {
  const portfolioThirdParties = REGISTER.map((entry) => {
    const random = generator(`register:${entry.id}`);
    const lastMonth = 1 + Math.floor(random() * 8);
    return {
      id: entry.id,
      runId,
      name: entry.name,
      domicile: entry.domicile,
      category: entry.category,
      criticality: entry.criticality,
      isOutsourcing: entry.criticality !== "standard",
      entityIds: entry.entityIds,
      status: entry.status ?? "active",
      relationshipOwnerUserId: entry.owner,
      annualSpend: entry.spend,
      lastAssessmentDate: `2026-${String(lastMonth).padStart(2, "0")}-15`,
      nextAssessmentDue: `${entry.criticality === "critical" ? "2027" : "2027"}-${String(lastMonth).padStart(2, "0")}-15`,
      assuranceReportDate: entry.assurance,
      description: entry.description,
    };
  });

  const portfolioProviderLinks = REGISTER.flatMap((entry) =>
    entry.links.map(([providerKey, serviceId, declared], index) => {
      const provider = PROVIDERS[providerKey];
      if (!provider) throw new Error(`Unknown provider ${providerKey} on ${entry.id}.`);
      return {
        id: `PPL-${entry.id}-${index + 1}`,
        runId,
        thirdPartyId: entry.id,
        providerKey,
        providerName: provider.name,
        providerDomicile: provider.domicile,
        serviceId,
        supportsCriticalFunction: entry.criticality === "critical",
        declared,
      };
    }),
  );

  const thirdPartyMonthlyMetrics = [
    ...Object.entries(OPERATIONAL_HISTORY).flatMap(([id, spec]) => monthlyMetrics(runId, id, spec)),
    ...REGISTER.map((entry) => ({
      entry,
      basalt: entry.links.some(([key]) => key === "basalt"),
    })).flatMap(({ entry, basalt }) =>
      monthlyMetrics(runId, entry.id, { pattern: entry.pattern, base: entry.base, basalt, assurance: entry.assurance }),
    ),
  ];

  const controlTestResults = input.controls.flatMap((control) => controlResults(runId, control));
  const kriHistory = input.kris.flatMap((kri) => kriHistoryRows(runId, kri));
  const riskAcceptances = ACCEPTANCES.map((row) => ({ ...row, id: row.reference, runId }));
  const serviceResilienceTests = RESILIENCE.map((row) => ({ ...row, id: `SRT-${row.reference}-${row.entityId}`, runId }));

  return {
    portfolioThirdParties,
    portfolioProviderLinks,
    thirdPartyMonthlyMetrics,
    controlTestResults,
    kriHistory,
    riskAcceptances,
    serviceResilienceTests,
  };
}
