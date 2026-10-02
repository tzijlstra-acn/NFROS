/**
 * Adds internal navigation link annotations to an existing image-based PDF.
 *
 * Each core slide that has appendixRefs gets a clickable annotation region
 * over each chip in the AppendixRefBar. Each appendix slide gets a return
 * link annotation over the return button area.
 *
 * Requires pdf-lib to be installed:
 *   npm install pdf-lib
 *
 * If pdf-lib is not available at runtime, the function returns the original
 * bytes unchanged and logs a warning. The export pipeline will not fail.
 */

import { CORE_SLIDES_V22 } from "../data/core-story";
import { APPENDIX_SLIDES } from "../data/appendix";

// ---------------------------------------------------------------------------
// Pixel geometry constants (1920 x 1080 slide canvas)
//
// These match the CSS layout defined in presentation-v2-2.css:
//   .pv22-ref-bar  { bottom: 64px; left: 48px; height: 40px; }
//   .pv22-ref-chip { height: 28px; }
//   chip gap = --pv22-space-3 = 12px
//   "More detail" label width (mono 11px, uppercase) approx 75px + 12px gap
//
// The return button sits in .pv22-appendix-footer (justify-content: flex-end).
// Its right edge is at 1920 - 48 = 1872px; width approx 120px.
//
// IMPORTANT: These are best-effort estimates. Calibrate against real captures
// by opening the exported PDF in Adobe Acrobat and using the Rectangle tool
// (Tools > Measure > Rectangle) to verify annotation regions.
// ---------------------------------------------------------------------------

const SLIDE_W_PX = 1920;
const SLIDE_H_PX = 1080;

// Ref bar: sits at bottom:64px left:48px, height 40px
const REF_BAR_BOTTOM_PX = 64;
const REF_BAR_LEFT_PX   = 48;
const REF_BAR_H_PX      = 40;

// Chip layout: label section (label + gap) precedes chips
const LABEL_SECTION_W_PX = 87; // "MORE DETAIL" label ~75px + 12px gap
const CHIP_W_PX          = 140;
const CHIP_GAP_PX        = 12; // --pv22-space-3

// Return button: right-aligned in appendix footer
// footer: bottom:0, padding 16px 48px; button height ~32px
const RETURN_BTN_W_PX        = 120;
const RETURN_BTN_H_PX        = 32;
const RETURN_BTN_RIGHT_PAD   = 48;
const RETURN_BTN_X_PX        = SLIDE_W_PX - RETURN_BTN_RIGHT_PAD - RETURN_BTN_W_PX; // 1752
const RETURN_BTN_BOTTOM_PX   = 20; // approx bottom padding in footer
const RETURN_BTN_Y_PX        = SLIDE_H_PX - RETURN_BTN_BOTTOM_PX - RETURN_BTN_H_PX; // ~1028

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads pdfBytes into pdf-lib, adds GoTo link annotations for appendix chips
 * and return buttons, and returns the annotated PDF bytes.
 *
 * Falls back to the original bytes and logs a warning if pdf-lib is not
 * installed or if annotation fails for any reason.
 */
export async function addPdfInternalLinks(pdfBytes: Uint8Array): Promise<Uint8Array> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let pdfLib: any;
  try {
    // @ts-ignore -- pdf-lib is an optional dependency; install with: npm install pdf-lib
    pdfLib = await import("pdf-lib");
  } catch {
    console.warn(
      "[pdf-links] pdf-lib not installed -- PDF link annotations skipped.\n" +
      "            Run `npm install` after adding pdf-lib to package.json.",
    );
    return pdfBytes;
  }

  try {
    return await annotatePdf(pdfLib, pdfBytes);
  } catch (err) {
    console.warn("[pdf-links] Annotation failed:", err instanceof Error ? err.message : String(err));
    return pdfBytes;
  }
}

// ---------------------------------------------------------------------------
// Internal implementation
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function annotatePdf(pdfLib: any, pdfBytes: Uint8Array): Promise<Uint8Array> {
  const { PDFDocument, PDFName, PDFNull } = pdfLib;

  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();

  const coreCount     = CORE_SLIDES_V22.length;       // 13
  const appendixStart = coreCount;                    // first appendix page index

  // Build appendix id -> page index map
  const appendixIdToPageIndex = new Map<string, number>();
  APPENDIX_SLIDES.forEach((slide, i) => {
    appendixIdToPageIndex.set(slide.id, appendixStart + i);
  });

  // -------------------------------------------------------------------------
  // Core slides: add chip annotations
  // -------------------------------------------------------------------------
  CORE_SLIDES_V22.forEach((slide, coreIndex) => {
    if (!slide.appendixRefs || slide.appendixRefs.length === 0) return;
    const page = pages[coreIndex];
    if (!page) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { width: pageW, height: pageH } = (page as any).getSize();
    const scaleX = pageW / SLIDE_W_PX;
    const scaleY = pageH / SLIDE_H_PX;

    // Bar top (PDF y=0 is bottom)
    const barTopFromTop  = SLIDE_H_PX - REF_BAR_BOTTOM_PX - REF_BAR_H_PX; // 976px
    const chipStartX_px  = REF_BAR_LEFT_PX + LABEL_SECTION_W_PX;           // 135px

    slide.appendixRefs.forEach((ref, chipIndex) => {
      const targetPageIndex = appendixIdToPageIndex.get(ref.appendixId);
      if (targetPageIndex === undefined) return;

      const chipLeft  = (chipStartX_px + chipIndex * (CHIP_W_PX + CHIP_GAP_PX)) * scaleX;
      const chipRight = chipLeft + CHIP_W_PX * scaleX;
      // PDF y=0 is bottom; convert from top-origin
      const chipBottom = pageH - (barTopFromTop + REF_BAR_H_PX) * scaleY;
      const chipTop    = pageH - barTopFromTop * scaleY;

      addGoToAnnotation(
        { PDFName, PDFNull },
        doc,
        page,
        chipLeft, chipBottom, chipRight - chipLeft, chipTop - chipBottom,
        targetPageIndex,
      );
    });
  });

  // -------------------------------------------------------------------------
  // Appendix slides: add return button annotation (links to first core slide)
  // -------------------------------------------------------------------------
  APPENDIX_SLIDES.forEach((_, appendixIndex) => {
    const pageIndex = appendixStart + appendixIndex;
    const page      = pages[pageIndex];
    if (!page) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { width: pageW, height: pageH } = (page as any).getSize();
    const scaleX = pageW / SLIDE_W_PX;
    const scaleY = pageH / SLIDE_H_PX;

    const btnLeft   = RETURN_BTN_X_PX * scaleX;
    const btnRight  = btnLeft + RETURN_BTN_W_PX * scaleX;
    const btnBottom = pageH - (RETURN_BTN_Y_PX + RETURN_BTN_H_PX) * scaleY;
    const btnTop    = pageH - RETURN_BTN_Y_PX * scaleY;

    // Return to first core slide (page index 0)
    addGoToAnnotation(
      { PDFName, PDFNull },
      doc,
      page,
      btnLeft, btnBottom, btnRight - btnLeft, btnTop - btnBottom,
      0,
    );
  });

  return doc.save();
}

/**
 * Appends a PDF GoTo link annotation to the given page.
 *
 * @param x      Left edge of the clickable region (in page units, x=0 is left)
 * @param y      Bottom edge of the clickable region (in page units, y=0 is bottom)
 * @param width  Width of the clickable region
 * @param height Height of the clickable region
 * @param targetPageIndex 0-based index of the target page in the document
 */
function addGoToAnnotation(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  { PDFName, PDFNull }: { PDFName: any; PDFNull: any },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  doc: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  page: any,
  x: number,
  y: number,
  width: number,
  height: number,
  targetPageIndex: number,
): void {
  const targetPage = doc.getPages()[targetPageIndex];
  if (!targetPage) return;

  // Build GoTo destination: [pageRef, /XYZ, null, null, null]
  // null means "keep current scroll position on the target page"
  const dest = doc.context.obj([
    targetPage.ref,
    PDFName.of("XYZ"),
    PDFNull,
    PDFNull,
    PDFNull,
  ]);

  // Action dict: GoTo action pointing to dest
  const actionDict = doc.context.obj({
    Type:  PDFName.of("Action"),
    S:     PDFName.of("GoTo"),
    D:     dest,
  });
  const actionRef = doc.context.register(actionDict);

  // Link annotation with invisible border
  const annotDict = doc.context.obj({
    Type:    PDFName.of("Annot"),
    Subtype: PDFName.of("Link"),
    Rect:    [x, y, x + width, y + height],
    Border:  [0, 0, 0],
    A:       actionRef,
  });
  const annotRef = doc.context.register(annotDict);

  // Append to page's Annots array (preserving any existing annotations)
  const annotsKey = PDFName.of("Annots");
  const existing  = page.node.get(annotsKey);
  if (existing && typeof existing.push === "function") {
    existing.push(annotRef);
  } else {
    page.node.set(annotsKey, doc.context.obj([annotRef]));
  }
}
