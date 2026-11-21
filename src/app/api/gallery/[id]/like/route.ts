// ============================================================
// ঠাট্টা স্টুডিও — Phase 7: like a gallery item
// POST /api/gallery/[id]/like → { likes }
// (client-side dedupe via localStorage — casual platform, no auth)
// ============================================================

import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: "গ্যালারি সার্ভার পাওয়া যায়নি" }, { status: 503 });
  }
  try {
    await ensureSchema();
    const { id } = await params;
    const item = await db.galleryItem.update({
      where: { id },
      data: { likes: { increment: 1 } },
      select: { id: true, likes: true },
    });
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "লাইক করা যায়নি" }, { status: 500 });
  }
}
