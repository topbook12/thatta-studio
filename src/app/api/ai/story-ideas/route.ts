// ============================================================
// ঠাট্টা স্টুডিও — Phase 9: AI গল্প-আইডিয়া জেনারেটর
// POST /api/ai/story-ideas  { topic?, castNames? }
// → { ideas: [{ title, premise }] }  (৩টি বাংলা কমেডি প্রেমিস)
// Family-safe: system prompt forbids vulgarity/religion/politics.
// ============================================================

import { aiError, chatJson, clampStr, clampStrList } from "@/lib/ai-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Idea {
  title: string;
  premise: string;
}

const SYSTEM = `তুমি "ঠাট্টা স্টুডিও"-র বাংলা কমেডি লেখক — গোপাল ভাঁড়ের মতো বুদ্ধিদীপ্ত, ভালোবাসা-ভরা রসিকতা তোমার বিশেষত্ব।
কাজ: ব্যবহারকারীর কার্টুনের জন্য ৩টি আলাদা গল্পের আইডিয়া দেওয়া।

নিয়ম:
- প্রতিটি আইডিয়া: ছোট মজার শিরোনাম (৪–৮ শব্দ) + ২–৩ বাক্যের প্রেমিস (কে, কোথায়, কী গন্ডগোল, শেষে মজার টুইস্ট)।
- গ্রাম/শহর বাংলাদেশ-পশ্চিমবঙ্গের চেনা পরিবেশ (বাজার, রাজসভা, স্কুল, নদীর ধার, মেলা, চায়ের দোকান)।
- পরিবার-বান্ধব: অশ্লীলতা, রাজনীতি, ধর্ম নিয়ে বিদ্রূপ, ঘৃণা — কিছুই নয়। দোষ সবারই, ক্ষতি কারও নয়।
- কমেডি আসবে বোকা বুদ্ধি, ভুল বোঝাবুঝি, কর্তা-চাকর উল্টো খেলা, লোভ-ভয়-গর্ব থেকে।
- শুধুমাত্র বৈধ JSON দাও, কোনো ব্যাখ্যা নয়:
{"ideas":[{"title":"...","premise":"..."},{"title":"...","premise":"..."},{"title":"...","premise":"..."}]}`;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return aiError(new Response(), 400, "ভুল অনুরোধ");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const topic = clampStr(b.topic, 200);
  const castNames = clampStrList(b.castNames, 8, 24);

  const user = [
    castNames.length
      ? `ক্যারেক্টার-দল (এই নামগুলো ব্যবহার করো): ${castNames.join(", ")}`
      : "ক্যারেক্টার-দল: তোমার পছন্দমতো বাংলা নাম",
    topic ? `পছন্দের বিষয়: ${topic}` : "কোনো নির্দিষ্ট বিষয় নেই — নতুন নতুন ৩টি সতেজ আইডিয়া দাও",
  ].join("\n");

  try {
    const out = await chatJson<{ ideas?: Idea[] }>({ system: SYSTEM, user });
    const ideas = (out.ideas ?? [])
      .filter((i) => i && typeof i.title === "string" && typeof i.premise === "string")
      .map((i) => ({
        title: i.title.trim().slice(0, 80),
        premise: i.premise.trim().slice(0, 400),
      }))
      .slice(0, 3);
    if (ideas.length === 0) {
      return aiError(new Response(), 502, "AI কোনো আইডিয়া দেয়নি — আবার চেষ্টা করুন");
    }
    return Response.json({ ideas });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI সার্ভারে সমস্যা";
    return aiError(new Response(), 502, msg);
  }
}
