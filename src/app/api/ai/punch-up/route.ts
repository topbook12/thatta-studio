// ============================================================
// ঠাট্টা স্টুডিও — Phase 9: AI সংলাপ পাঞ্চ-আপ
// POST /api/ai/punch-up  { lines: [{ id, text }], castNames? }
// → { suggestions: [{ id, text, note }] }
// Makes each dialogue line funnier WITHOUT changing meaning,
// family-safe, similar length (TTS timing stays sane).
// ============================================================

import { aiError, chatJson, clampStr, clampStrList } from "@/lib/ai-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface InLine {
  id: string;
  text: string;
}

interface Suggestion extends InLine {
  note?: string;
}

const SYSTEM = `তুমি "ঠাট্টা স্টুডিও"-র সংলাপ-ডাক্তার — বাংলা কমেডি সংলাপ ঝাঁঝালো করার বিশেষজ্ঞ।
কাজ: প্রতিটি সংলাপের অর্থ ও বক্তার ভাব ঠিক রেখে মজার সংস্করণ লেখা।

নিয়ম:
- মূল অর্থ/তথ্য অপরিবর্তিত — শুধু রসিকতা বাড়াও (কথ্য-ভাষা, ছোট শব্দ-খেলা, বাড়াবাড়ি, গোপাল-ভাঁড়-স্টাইল টুইস্ট)।
- দৈর্ঘ্য মোটামুটি একই রাখো (±২০%) — ভয়েস টাইমিং কাছাকাছি থাকবে।
- পরিবার-বান্ধব: অশ্লীলতা, ব্যক্তিগত আক্রমণ, রাজনীতি, ধর্ম — নয়।
- এমন লাইন যা ইতিমধ্যে যথেষ্ট মজার — সূক্ষ্ম পরিবর্তন বা প্রায় একই রাখো।
- প্রতিটির সাথে ৩–৮ শব্দের "note": কী বদলাল সেটার মজার হিন্ট (বাংলায়)।
- শুধুমাত্র বৈধ JSON দাও, কোনো ব্যাখ্যা নয়:
{"suggestions":[{"id":"...","text":"...","note":"..."}]}
"id" হুবহু ইনপুটের একই রাখতে হবে, ইনপুটের প্রতিটি লাইনের জন্য একটি করে সাজেশন।`;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return aiError(new Response(), 400, "ভুল অনুরোধ");
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const castNames = clampStrList(b.castNames, 8, 24);

  const rawLines = Array.isArray(b.lines) ? b.lines : [];
  const lines: InLine[] = rawLines
    .filter(
      (l): l is InLine =>
        !!l &&
        typeof l === "object" &&
        typeof (l as InLine).id === "string" &&
        typeof (l as InLine).text === "string",
    )
    .map((l) => ({ id: l.id.slice(0, 40), text: clampStr(l.text, 300) }))
    .filter((l) => l.text.length > 0)
    .slice(0, 24);

  if (lines.length === 0) {
    return aiError(new Response(), 400, "সংলাপ পাওয়া যায়নি");
  }

  const user = [
    castNames.length ? `ক্যারেক্টার: ${castNames.join(", ")}` : "",
    "সংলাপগুলো ঝাঁঝালো করো:",
    ...lines.map((l, i) => `${i + 1}. id="${l.id}" — "${l.text}"`),
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const out = await chatJson<{ suggestions?: Suggestion[] }>({ system: SYSTEM, user });
    const byId = new Map(lines.map((l) => [l.id, l]));
    const suggestions = (out.suggestions ?? [])
      .filter(
        (s): s is Suggestion =>
          !!s && typeof s.id === "string" && typeof s.text === "string" && byId.has(s.id),
      )
      .map((s) => ({
        id: s.id,
        text: clampStr(s.text, 300),
        note: clampStr(s.note, 60),
      }));
    if (suggestions.length === 0) {
      return aiError(new Response(), 502, "AI কোনো সাজেশন দেয়নি — আবার চেষ্টা করুন");
    }
    return Response.json({ suggestions });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI সার্ভারে সমস্যা";
    return aiError(new Response(), 502, msg);
  }
}
