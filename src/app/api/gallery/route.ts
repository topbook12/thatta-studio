// ============================================================
// ঠাট্টা স্টুডিও — Phase 7: কমিউনিটি গ্যালারি API
//
// GET  /api/gallery?sort=recent|popular&author=&q=   → metadata list
// POST /api/gallery                                  → publish an episode
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { ensureSchema, getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/** hard limits — a project JSON should stay well under this */
const MAX_DATA_BYTES = 4 * 1024 * 1024;
const MAX_THUMB_BYTES = 400 * 1024;

const cloudUnavailable = () =>
  NextResponse.json(
    {
      error: "গ্যালারি সার্ভার এই ডিপ্লয়ে পাওয়া যায়নি",
      hint: "অ্যাপ অফলাইনেও পুরো চলে — কাজ ডিভাইসেই সেভ হচ্ছে।",
    },
    { status: 503 },
  );

export async function GET(req: NextRequest) {
  const db = getDb();
  if (!db) return cloudUnavailable();
  try {
    await ensureSchema();
    const sp = req.nextUrl.searchParams;
    const sort = sp.get("sort") === "popular" ? "popular" : "recent";
    const author = (sp.get("author") ?? "").trim().slice(0, 80);
    const q = (sp.get("q") ?? "").trim().slice(0, 80);
    const limit = Math.min(60, Math.max(1, Number(sp.get("limit")) || 60));

    const items = await db.galleryItem.findMany({
      where: {
        ...(author ? { author } : {}),
        ...(q
          ? { OR: [{ name: { contains: q } }, { author: { contains: q } }] }
          : {}),
      },
      orderBy: sort === "popular" ? [{ likes: "desc" }, { createdAt: "desc" }] : { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        name: true,
        author: true,
        thumbnail: true,
        duration: true,
        likes: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "গ্যালারি লোড করা যায়নি" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const db = getDb();
  if (!db) return cloudUnavailable();
  try {
    await ensureSchema();
    const body = (await req.json()) as {
      name?: unknown;
      author?: unknown;
      data?: unknown;
      thumbnail?: unknown;
      duration?: unknown;
    };

    const name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
    const author = typeof body.author === "string" ? body.author.trim().slice(0, 80) : "";
    const data = typeof body.data === "string" ? body.data : "";
    const thumbnail =
      typeof body.thumbnail === "string" && body.thumbnail.startsWith("data:image/")
        ? body.thumbnail
        : null;
    const duration = typeof body.duration === "number" && Number.isFinite(body.duration)
      ? Math.max(0, Math.min(600, body.duration))
      : 0;

    if (!name || !author) {
      return NextResponse.json(
        { error: "কার্টুনের নাম ও লেখকের নাম দিন" },
        { status: 400 },
      );
    }
    if (!data) {
      return NextResponse.json({ error: "প্রজেক্ট ডেটা নেই" }, { status: 400 });
    }
    if (new Blob([data]).size > MAX_DATA_BYTES) {
      return NextResponse.json(
        { error: "প্রজেক্ট খুব বড় — কিছু দৃশ্য বাদ দিয়ে চেষ্টা করুন" },
        { status: 413 },
      );
    }
    if (thumbnail && thumbnail.length > MAX_THUMB_BYTES) {
      return NextResponse.json({ error: "থাম্বনেইল খুব বড়" }, { status: 413 });
    }

    // sanity-check the payload shape before storing it
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      return NextResponse.json({ error: "প্রজেক্ট ডেটা ভাঙা" }, { status: 400 });
    }
    const obj = parsed as { designs?: unknown; scenes?: unknown };
    if (!Array.isArray(obj?.designs) || !Array.isArray(obj?.scenes) || obj.scenes.length === 0) {
      return NextResponse.json(
        { error: "প্রজেক্ট ডেটা ভাঙা — designs/scenes নেই" },
        { status: 400 },
      );
    }

    const item = await db.galleryItem.create({
      data: { name, author, data, thumbnail, duration },
      select: { id: true, name: true, createdAt: true },
    });
    return NextResponse.json({ item }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "পাবলিশ করা যায়নি" }, { status: 500 });
  }
}
