import {
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFRawStream,
  PDFRef,
  PDFString,
  decodePDFRawStream,
  rgb,
  type PDFObject,
  type PDFPage,
} from "pdf-lib";
import { SLIDE_H_PX, SLIDE_W_PX, type SlideRect } from "./types";

// 1920 x 1080 CSS pixels at 0.75 pt per pixel
export const PAGE_W_PT = 1440;
export const PAGE_H_PT = 810;

export interface PdfLinkInput {
  rect: SlideRect;
  targetIndex: number;
  name: string;
  tooltip: string;
}

export interface PdfPageInput {
  image: Uint8Array;
  format: "jpeg" | "png";
  links: PdfLinkInput[];
}

export interface PdfMeta {
  title: string;
  subject: string;
  keywords: string[];
  author: string;
  creator: string;
  producer: string;
  date: Date;
}

export function slideRectToPdf(rect: SlideRect, pageW: number, pageH: number): [number, number, number, number] {
  const sx = pageW / SLIDE_W_PX;
  const sy = pageH / SLIDE_H_PX;
  const r = (n: number) => Math.round(n * 100) / 100;
  return [r(rect.x * sx), r(pageH - (rect.y + rect.h) * sy), r((rect.x + rect.w) * sx), r(pageH - rect.y * sy)];
}

export async function buildImagePdf(pages: readonly PdfPageInput[], meta: PdfMeta): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(meta.title, { showInWindowTitleBar: true });
  doc.setSubject(meta.subject);
  doc.setKeywords(meta.keywords);
  doc.setAuthor(meta.author);
  doc.setCreator(meta.creator);
  doc.setProducer(meta.producer);
  doc.setCreationDate(meta.date);
  doc.setModificationDate(meta.date);
  doc.setLanguage("en-GB");

  const pdfPages: PDFPage[] = [];
  for (const input of pages) {
    const page = doc.addPage([PAGE_W_PT, PAGE_H_PT]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT, color: rgb(1, 1, 1) });
    const image = input.format === "jpeg" ? await doc.embedJpg(input.image) : await doc.embedPng(input.image);
    page.drawImage(image, { x: 0, y: 0, width: PAGE_W_PT, height: PAGE_H_PT });
    pdfPages.push(page);
  }

  pages.forEach((input, pageIndex) => {
    const page = pdfPages[pageIndex];
    if (!page || input.links.length === 0) return;
    const annots: PDFRef[] = [];
    for (const link of input.links) {
      const target = pdfPages[link.targetIndex];
      if (!target) throw new Error(`Link "${link.name}" on page ${pageIndex + 1} targets missing page ${link.targetIndex + 1}.`);
      const action = doc.context.obj({
        Type: "Action",
        S: "GoTo",
        D: [target.ref, PDFName.of("Fit")],
      });
      const annot = doc.context.obj({
        Type: "Annot",
        Subtype: "Link",
        Rect: slideRectToPdf(link.rect, PAGE_W_PT, PAGE_H_PT),
        Border: [0, 0, 0],
        F: 4,
        NM: PDFString.of(link.name),
        Contents: PDFHexString.fromText(link.tooltip),
        A: doc.context.register(action),
      });
      annots.push(doc.context.register(annot));
    }
    page.node.set(PDFName.of("Annots"), doc.context.obj(annots));
  });

  return doc.save({ useObjectStreams: false });
}

export interface PdfLinkInfo {
  pageIndex: number;
  name: string;
  rect: [number, number, number, number];
  destPageIndex: number | null;
  actionType: string;
}

export interface PdfInspection {
  pageCount: number;
  pageSizes: Array<{ width: number; height: number }>;
  links: PdfLinkInfo[];
  info: { title: string; subject: string; keywords: string; author: string; creator: string; producer: string };
  textStreams: string[];
}

function textOf(obj: PDFObject | undefined): string {
  if (obj instanceof PDFString || obj instanceof PDFHexString) return obj.decodeText();
  return "";
}

export async function inspectPdf(bytes: Uint8Array): Promise<PdfInspection> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const pages = doc.getPages();
  const refIndex = new Map<string, number>();
  pages.forEach((p, i) => refIndex.set(p.ref.toString(), i));

  const links: PdfLinkInfo[] = [];
  pages.forEach((page, pageIndex) => {
    const annots = page.node.lookupMaybe(PDFName.of("Annots"), PDFArray);
    if (!annots) return;
    for (let i = 0; i < annots.size(); i++) {
      const annot = annots.lookupMaybe(i, PDFDict);
      if (!annot) continue;
      const subtype = annot.lookupMaybe(PDFName.of("Subtype"), PDFName);
      if (subtype?.asString() !== "/Link") continue;
      const rectArr = annot.lookupMaybe(PDFName.of("Rect"), PDFArray);
      const rect = (rectArr?.asArray() ?? []).map((n) => (n instanceof PDFNumber ? n.asNumber() : NaN));
      let dest: PDFArray | undefined;
      let actionType = "none";
      const action = annot.lookupMaybe(PDFName.of("A"), PDFDict);
      if (action) {
        actionType = action.lookupMaybe(PDFName.of("S"), PDFName)?.asString().replace("/", "") ?? "unknown";
        dest = action.lookupMaybe(PDFName.of("D"), PDFArray);
      } else {
        dest = annot.lookupMaybe(PDFName.of("Dest"), PDFArray);
        if (dest) actionType = "Dest";
      }
      const first = dest?.get(0);
      const destPageIndex = first instanceof PDFRef ? (refIndex.get(first.toString()) ?? -1) : null;
      links.push({
        pageIndex,
        name: textOf(annot.get(PDFName.of("NM"))),
        rect: [rect[0] ?? NaN, rect[1] ?? NaN, rect[2] ?? NaN, rect[3] ?? NaN],
        destPageIndex,
        actionType,
      });
    }
  });

  const textStreams: string[] = [];
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFRawStream)) continue;
    const subtype = obj.dict.lookupMaybe(PDFName.of("Subtype"), PDFName)?.asString();
    if (subtype === "/Image") continue;
    try {
      textStreams.push(Buffer.from(decodePDFRawStream(obj).decode()).toString("latin1"));
    } catch {
      textStreams.push(Buffer.from(obj.contents).toString("latin1"));
    }
  }

  return {
    pageCount: pages.length,
    pageSizes: pages.map((p) => p.getSize()),
    links,
    info: {
      title: doc.getTitle() ?? "",
      subject: doc.getSubject() ?? "",
      keywords: doc.getKeywords() ?? "",
      author: doc.getAuthor() ?? "",
      creator: doc.getCreator() ?? "",
      producer: doc.getProducer() ?? "",
    },
    textStreams,
  };
}
