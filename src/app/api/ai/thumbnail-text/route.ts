// ============================================================
// ঠাট্টা স্টুডিও — Phase 9: AI থাম্বনেইল টেক্সট সাজেশন
// POST /api/ai/thumbnail-text  { title?, premise?, castNames? }
// → { items: [{ title, subtitle }] }  (৫টি ছোট, ঝাঁঝালো জোড়া)
// Thumbnail text must be SHORT — readable at 320px wide.
// ============================================================

import { aiError, chatJson, clampStr, clampStrList } from "@/lib/ai-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ThumbItem {
  title: string;
  subtitle: string;
}

const SYSTEM = `তুমি "ঠাট্টা স্টুডিও"-র থাম্বনেইল-টেক্সট বিশেষজ্ঞ — YouTube/Facebook বাংলা কমেডি কার্টুনের ক্লিকযোগ্য টাইটেল লেখার গুরু।

নিয়ম:
- ৫টি আলাদা জোড়া দাও।
- "title": মেইন টাইটেল — সর্বোচ্চ ৫ শব্দ, বড় অক্ষরে পড়ার মতো ছোট ও ঝাঁঝালো (কৌতূহল/হাসি তৈরি করে)।
- "subtitle": সাব-টাইটেল — সর্বোচ্চ ৫ শব্দ, গল্পের রঙ দেয় (যেমন "গোপালের মিষ্টি কাণ্ড")।
- প্রতিটি জোড়া আলাদা কৌশলে: প্রশ্ন, বাড়াবাড়ি, রহস্য, উল্টো মন্তব্য, সংখ্যা-ধর্মী — বিভিন্ন স্বাদ।
- পরিবার-বান্ধব, clickbait হলেও মিথ্যা প্রতিশ্রুতি নয়।
- শুধুমাত্র বৈধ JSON দাও, কোনো ব্যাখ্যা নয়:
{"items":[{"title":"...","subtitle":"..."},{"title":"...","subtitle":"..."},{"title":"...","subtitle":"..."},{"title":"...","subtitle":"..."},{"title":"...","subtitle":"..."}]}`;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return aiError(new Response(), 400, "ভুল অনুরোধ");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const title = clampStr(b.title, 80);
  const premise = clampStr(b.premise, 400);
  const castNames = clampStrList(b.castNames, 8, 24);

  if (!title && !premise) {
    return aiError(new Response(), 400, "কার্টুনের নাম বা গল্প দিন");
  }

  const user = [
    title ? `কার্টুনের নাম: ${title}` : "",
    premise ? `গল্পের বর্ণনা: ${premise}` : "",
    castNames.length ? `ক্যারেক্টার: ${castNames.join(", ")}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const out = await chatJson<{ items?: ThumbItem[] }>({ system: SYSTEM, user });
    const items = (out.items ?? [])
      .filter((i) => i && typeof i.title === "string" && typeof i.subtitle === "string")
      .map((i) => ({
        title: i.title.trim().slice(0, 48),
        subtitle: i.subtitle.trim().slice(0, 40),
      }))
      .filter((i) => i.title)
      .slice(0, 5);
    if (items.length === 0) {
      return aiError(new Response(), 502, "AI সাজেশন দিতে পারেনি — আবার চেষ্টা করুন");
    }
    return Response.json({ items });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI সার্ভারে সমস্যা";
    return aiError(new Response(), 502, msg);
  }
}
