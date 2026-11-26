// ============================================================
// ঠাট্টা স্টুডিও — Phase 9: AI অটো-স্টোরিবোর্ড
// POST /api/ai/storyboard  { title, premise, castNames, scenes? }
// → { script: string } — বাংলা স্ক্রিপ্ট টেক্সট ঠিক সেই ফরম্যাটে
//   যা Phase 2-র পার্সার (script-parser.ts) সরাসরি বোঝে:
//     নাম (হাসতে হাসতে): সংলাপ
//     --- দৃশ্যের নাম ---
// Output feeds straight into the ScriptDialog → beats pipeline,
// so "idea → draft → user edits → playable scene" stays one flow.
// ============================================================

import { aiError, chatJson, clampStr, clampStrList } from "@/lib/ai-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HINTS = [
  "হাসতে হাসতে",
  "রেগে",
  "ভয়ে কাঁপতে কাঁপতে",
  "চমকে",
  "কাঁদতে কাঁদতে",
  "ভাবতে ভাবতে",
  "নাচতে নাচতে",
  "নমস্কার করে",
  "দৌড়ে",
  "তালি দিয়ে",
  "মিষ্টি খেতে খেতে",
  "হাত নাড়তে নাড়তে",
  "থাপ্পড় মারতে গিয়ে",
  "ঘুমিয়ে পড়ে",
];

const SYSTEM = `তুমি "ঠাট্টা স্টুডিও"-র বাংলা কমেডি স্ক্রিপ্ট লেখক (গোপাল ভাঁড় ঘরানার ঠাট্টা)।
কাজ: একটি প্রেমিস থেকে কার্টুন স্ক্রিপ্ট লেখা — ঠিক নিচের ফরম্যাটে।

ফরম্যাট নিয়ম (একদম কঠোর):
1. প্রতিটি সংলাপ-লাইন: "নাম: সংলাপ" বা ভাব বোঝাতে "নাম (হাসতে হাসতে): সংলাপ"
2. নামের ভেতরে কোনো কোলন/বন্ধনী/দাঁড়ি/সংখ্যা থাকবে না।
3. শুধু ব্যবহারকারীর দেওয়া ক্যারেক্টার-নামই স্পিকার হবে — নতুন নাম, "নাম" বা কোনো placeholder নয়; প্রতিটি লাইনের নাম তালিকার একটি নাম হুবহু হবে।
4. ভাব-বন্ধনী শুধু এইগুলো থেকে: (${HINTS.join(", ")})
5. নতুন দৃশ্যের আগে: "--- দৃশ্যের ছোট নাম ---" (একটি লাইনে)
6. ২–৩টি দৃশ্য, মোট ৮–১৪টি সংলাপ, প্রতিটি সংলাপ ২০–১২০ অক্ষর।
7. শেষ লাইন হবে ঝাঁঝালো পাঞ্চলাইন — গল্প তাতেই শেষ হবে।
8. পরিবার-বান্ধব: অশ্লীল, রাজনৈতিক, ধর্মীয় বিদ্রূপ — কিছুই নয়।
9. উত্তরে শুধু JSON, কোনো ব্যাখ্যা নয়:
{"script":"নাম: প্রথম সংলাপ\\nনাম (রেগে): দ্বিতীয় সংলাপ\\n--- দ্বিতীয় দৃশ্য ---\\n..."}`;

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
  const scenes = Math.min(3, Math.max(1, Number(b.scenes) || 2));

  if (!premise) {
    return aiError(new Response(), 400, "গল্পের বর্ণনা দরকার");
  }

  const user = [
    title ? `গল্পের শিরোনাম: ${title}` : "",
    `প্রেমিস: ${premise}`,
    castNames.length
      ? `ক্যারেক্টার-দল (শুধু এই নামগুলোই স্পিকার): ${castNames.join(", ")}`
      : "ক্যারেক্টার-দল: ২–৩ জনের বাংলা নাম নিজে ঠিক করো",
    `দৃশ্য সংখ্যা: ${scenes}`,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const out = await chatJson<{ script?: string }>({ system: SYSTEM, user });
    let script = typeof out.script === "string" ? out.script.trim() : "";
    if (!script) {
      return aiError(new Response(), 502, "AI স্ক্রিপ্ট লিখতে পারেনি — আবার চেষ্টা করুন");
    }
    // hard safety net: cap length, strip anything that could break the parser
    script = script.slice(0, 6000);
    return Response.json({ script });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI সার্ভারে সমস্যা";
    return aiError(new Response(), 502, msg);
  }
}
