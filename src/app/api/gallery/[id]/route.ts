// ============================================================
// ঠাট্টা স্টুডিও — Phase 7: one shared episode
// GET /api/gallery/[id] → full item (with data) to load into the studio
// ============================================================

import { NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
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
    const item = await db.galleryItem.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        author: true,
        data: true,
        duration: true,
        likes: true,
        createdAt: true,
      },
    });
    if (!item) {
      return NextResponse.json({ error: "পাওয়া যায়নি" }, { status: 404 });
    }
    return NextResponse.json({ item });
  } catch {
    return NextResponse.json({ error: "লোড করা যায়নি" }, { status: 500 });
  }
}
