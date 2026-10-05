/**
 * GET /api/downloads/[filename]
 *
 * Serves presentation artefacts from public/downloads/ for download.
 *
 * Security:
 *   - Only files on the explicit whitelist are served; all others return 404.
 *   - Path traversal characters (../ etc.) are rejected with 400.
 *   - Error responses do not expose server-side paths.
 */

import { NextRequest, NextResponse } from "next/server";
import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Whitelist
// ---------------------------------------------------------------------------

const ALLOWED_FILES = [
  "NFROS_Risk_Audience_Core.pdf",
  "NFROS_Risk_Audience_Core_and_Appendix.pdf",
  "NFROS_Risk_Audience_Export_Metadata.json",
  "NFROS_Risk_Audience_V24_Core.pdf",
  "NFROS_Risk_Audience_V24_Core_and_Appendix.pdf",
  "NFROS_Risk_Audience_V24_Core_and_Appendix.pptx",
  "NFROS_Risk_Audience_V24_Speaker_Notes.md",
] as const;

type AllowedFile = (typeof ALLOWED_FILES)[number];

function isAllowed(name: string): name is AllowedFile {
  return (ALLOWED_FILES as readonly string[]).includes(name);
}

const CONTENT_TYPE: Record<AllowedFile, string> = {
  "NFROS_Risk_Audience_Core.pdf": "application/pdf",
  "NFROS_Risk_Audience_Core_and_Appendix.pdf": "application/pdf",
  "NFROS_Risk_Audience_Export_Metadata.json": "application/json",
  "NFROS_Risk_Audience_V24_Core.pdf": "application/pdf",
  "NFROS_Risk_Audience_V24_Core_and_Appendix.pdf": "application/pdf",
  "NFROS_Risk_Audience_V24_Core_and_Appendix.pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "NFROS_Risk_Audience_V24_Speaker_Notes.md": "text/markdown; charset=utf-8",
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> },
): Promise<NextResponse> {
  const { filename } = await params;

  // Reject any path traversal attempts before touching the filesystem.
  if (
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    filename.includes("\0")
  ) {
    return new NextResponse("Bad request", { status: 400 });
  }

  // Enforce the whitelist.
  if (!isAllowed(filename)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const downloadsDir = resolve(process.cwd(), "public", "downloads");
  const filePath = join(downloadsDir, filename);

  if (!existsSync(filePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  try {
    const fileBuffer = readFileSync(filePath);
    const contentType = CONTENT_TYPE[filename];

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    // Do not expose internal details.
    return new NextResponse("Internal error", { status: 500 });
  }
}
