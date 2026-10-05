import { posix } from "node:path";
import { readZip } from "./zip";

export interface PptxLinkInfo {
  name: string;
  tooltip: string;
  action: string;
  relTarget: string;
  targetSlide: number | null;
}

export interface PptxSlideInfo {
  number: number;
  part: string;
  notesPart: string | null;
  notesText: string;
  imageCount: number;
  links: PptxLinkInfo[];
}

export interface PptxInspection {
  slideCount: number;
  slides: PptxSlideInfo[];
  coreXml: string;
  xmlParts: Array<{ part: string; text: string }>;
}

interface Rel {
  id: string;
  type: string;
  target: string;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

function attr(tag: string, name: string): string {
  const match = new RegExp(`\\s${name.replace(":", "\\:")}="([^"]*)"`).exec(tag);
  return match?.[1] !== undefined ? decodeXml(match[1]) : "";
}

function parseRels(xml: string | undefined): Rel[] {
  if (!xml) return [];
  return Array.from(xml.matchAll(/<Relationship\b[^>]*>/g)).map((m) => ({
    id: attr(m[0], "Id"),
    type: attr(m[0], "Type"),
    target: attr(m[0], "Target"),
  }));
}

function relsPathFor(part: string): string {
  return posix.join(posix.dirname(part), "_rels", `${posix.basename(part)}.rels`);
}

function resolvePart(fromPart: string, target: string): string {
  return posix.normalize(posix.join(posix.dirname(fromPart), target));
}

function notesBodyText(xml: string): string {
  const shapes = xml.split("<p:sp>").slice(1);
  const body = shapes.find((s) => /<p:ph\b[^>]*type="body"/.test(s)) ?? "";
  const paragraphs = body.split("</a:p>").map((p) =>
    Array.from(p.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g))
      .map((m) => decodeXml(m[1] ?? ""))
      .join(""),
  );
  return paragraphs.join("\n").trim();
}

export function inspectPptx(buffer: Buffer): PptxInspection {
  const zip = readZip(buffer);
  const read = (part: string) => zip.get(part)?.toString("utf8");

  const presentation = read("ppt/presentation.xml");
  if (!presentation) throw new Error("ppt/presentation.xml is missing.");
  const presRels = parseRels(read("ppt/_rels/presentation.xml.rels"));
  const order = Array.from(presentation.matchAll(/<p:sldId\b[^>]*>/g)).map((m) => {
    const rid = attr(m[0], "r:id");
    const rel = presRels.find((r) => r.id === rid);
    return rel ? resolvePart("ppt/presentation.xml", rel.target) : "";
  });
  const numberOf = new Map(order.map((part, i) => [part, i + 1]));

  const slides: PptxSlideInfo[] = order.map((part, i) => {
    const xml = read(part) ?? "";
    const rels = parseRels(read(relsPathFor(part)));
    const notesRel = rels.find((r) => r.type.endsWith("/notesSlide"));
    const notesPart = notesRel ? resolvePart(part, notesRel.target) : null;
    const notesXml = notesPart ? read(notesPart) : undefined;

    const links: PptxLinkInfo[] = [];
    for (const m of xml.matchAll(/<p:cNvPr\b[^>]*>([\s\S]*?)<\/p:cNvPr>/g)) {
      const open = /<p:cNvPr\b[^>]*>/.exec(m[0])?.[0] ?? "";
      const hlink = /<a:hlinkClick\b[^>]*\/?>/.exec(m[1] ?? "")?.[0];
      if (!hlink) continue;
      const rel = rels.find((r) => r.id === attr(hlink, "r:id"));
      const relTarget = rel ? resolvePart(part, rel.target) : "";
      links.push({
        name: attr(open, "name"),
        tooltip: attr(hlink, "tooltip"),
        action: attr(hlink, "action"),
        relTarget: rel ? `${rel.type.split("/").pop() ?? ""}:${rel.target}` : "",
        targetSlide: rel && rel.type.endsWith("/slide") ? (numberOf.get(relTarget) ?? -1) : null,
      });
    }

    return {
      number: i + 1,
      part,
      notesPart,
      notesText: notesXml ? notesBodyText(notesXml) : "",
      imageCount: (xml.match(/<p:pic>/g) ?? []).length,
      links,
    };
  });

  const xmlParts = Array.from(zip.entries())
    .filter(([name]) => /\.(xml|rels)$/i.test(name))
    .map(([part, data]) => ({ part, text: data.toString("utf8") }));

  return { slideCount: order.length, slides, coreXml: read("docProps/core.xml") ?? "", xmlParts };
}
