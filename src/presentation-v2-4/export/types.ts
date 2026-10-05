export const DECK_VERSION = "v2.4";
export const DECK_NAME = "NFROS Risk Audience Presentation";
export const SLIDE_W_PX = 1920;
export const SLIDE_H_PX = 1080;

export type SlideKind = "core" | "closing" | "appendix-index" | "appendix";

export interface ManifestEntry {
  key: string;
  kind: SlideKind;
  position: number;
  coreNumber: number | null;
  id: string;
  title: string;
  section: string;
  group: string | null;
  url: string;
  speakerNotes: string;
}

export type LinkTarget =
  | { type: "appendix"; id: string }
  | { type: "core"; coreNumber: number }
  | { type: "appendix-index" };

export type LinkKind =
  | "appendix-chip"
  | "appendix-cross"
  | "return"
  | "index-entry"
  | "index-link"
  | "core-link";

export const LINK_KINDS: readonly LinkKind[] = [
  "appendix-chip",
  "appendix-cross",
  "return",
  "index-entry",
  "index-link",
  "core-link",
];

export interface SlideRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MeasuredAnchor {
  target: string;
  label: string;
  rect: SlideRect;
}

export interface ResolvedLink {
  sourceIndex: number;
  target: string;
  kind: LinkKind;
  targetIndex: number;
  label: string;
  rect: SlideRect;
}

export type LinkCounts = Record<LinkKind, number> & { total: number };

export const FILE_NAMES = {
  corePdf: "NFROS_Risk_Audience_V24_Core.pdf",
  fullPdf: "NFROS_Risk_Audience_V24_Core_and_Appendix.pdf",
  pptx: "NFROS_Risk_Audience_V24_Core_and_Appendix.pptx",
  notes: "NFROS_Risk_Audience_V24_Speaker_Notes.md",
  metadata: "NFROS_Risk_Audience_V24_Export_Metadata.json",
  hash: "NFROS_Risk_Audience_V24_Export_Hash.txt",
} as const;

export const DELIVERABLES = [
  FILE_NAMES.corePdf,
  FILE_NAMES.fullPdf,
  FILE_NAMES.pptx,
  FILE_NAMES.notes,
] as const;

export const CORE_PDF_NOTE =
  "Appendix references are shown on the core slides but are not linked in this file. They resolve in the full deck, NFROS_Risk_Audience_V24_Core_and_Appendix.pdf.";

export interface ExportFileRecord {
  name: string;
  bytes: number;
  sha256: string;
}

export interface ExportSlideRecord {
  page: number;
  key: string;
  kind: SlideKind;
  coreNumber: number | null;
  id: string;
  title: string;
  section: string;
  group: string | null;
  url: string;
  image: string;
  links: Array<{ target: string; kind: LinkKind; targetPage: number; rect: SlideRect }>;
}

export interface ExportMetadata {
  deckVersion: string;
  deckName: string;
  exportedAt: string;
  gitCommit: string;
  workingTreeDirty: boolean;
  mode: "release" | "draft";
  audience: "internal-review" | "client-facing";
  brandMode: string;
  brandAssets: { configured: boolean; logo: boolean; greaterThan: boolean; font: boolean };
  brandPreflight: { status: "passed" | "failed" | "not-run"; exitCode: number | null };
  productProofGate: {
    status: "passed" | "failed" | "not-run";
    script: string;
    detail: string;
    pendingCaptureSlides: string[];
  };
  manifestSource: "dom" | "data-fallback";
  capture: {
    viewport: string;
    deviceScaleFactor: number;
    documentImageFormat: "jpeg" | "png";
    jpegQuality: number | null;
    readySignalObserved: number;
    readySignalMissing: string[];
  };
  slideCounts: {
    core: number;
    closing: number;
    appendixIndex: number;
    appendix: number;
    total: number;
    corePdfPages: number;
    fullPdfPages: number;
    pptxSlides: number;
  };
  links: {
    corePdf: LinkCounts;
    corePdfAppendixRefsNotLinked: number;
    fullPdf: LinkCounts;
    pptx: LinkCounts;
  };
  corePdfNote: string;
  files: ExportFileRecord[];
  slides: ExportSlideRecord[];
  integrityWarnings: string[];
  linkNotices: string[];
  disclosures: { syntheticData: string; regulatory: string };
}
