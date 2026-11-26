// ============================================================
// ঠাট্টা স্টুডিও — Phase 9: AI সহকারী (server-side)
//
// Shared helper for the /api/ai/* routes. Wraps z-ai-web-dev-sdk
// with: single ZAI instance reuse, JSON-mode prompting, tolerant
// JSON extraction (models sometimes wrap JSON in prose or fences),
// timeouts and consistent error responses.
//
// NEVER import this file from client code — the SDK is server-only.
// ============================================================

import ZAI from "z-ai-web-dev-sdk";

/** Single shared client (lazy — created on first use). */
let zaiInstance: Awaited<ReturnType<typeof ZAI.create>> | null = null;

async function getZai() {
  if (!zaiInstance) zaiInstance = await ZAI.create();
  return zaiInstance;
}

/**
 * Ask the model for a JSON answer and parse it defensively.
 * Throws a plain Error with a Bangla-friendly message on failure —
 * route handlers translate that into HTTP responses.
 */
export async function chatJson<T>(opts: {
  system: string;
  user: string;
  /** hard timeout ms (default 30 s) */
  timeoutMs?: number;
}): Promise<T> {
  const zai = await getZai();

  const completion = (await Promise.race([
    zai.chat.completions.create({
      messages: [
        { role: "assistant", content: opts.system },
        { role: "user", content: opts.user },
      ],
      thinking: { type: "disabled" },
    }),
    new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("AI উত্তর দিতে বেশি সময় নিল")), opts.timeoutMs ?? 30_000),
    ),
  ])) as { choices?: { message?: { content?: string } }[] };

  const raw = completion.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson<T>(raw);
  if (parsed === null) throw new Error("AI-এর উত্তর বোঝা যায়নি — আবার চেষ্টা করুন");
  return parsed;
}

/**
 * Pull the first JSON object/array out of a model answer.
 * Handles ```json fences, leading prose and trailing notes.
 */
export function extractJson<T>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();

  // strip a ```json ... ``` fence (or ``` ... ```) if present
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  // direct parse?
  try {
    return JSON.parse(text) as T;
  } catch {
    /* fall through to brace scanning */
  }

  // scan: first '{' or '[' … matching last '}' or ']'
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  const start =
    firstArr !== -1 && (firstObj === -1 || firstArr < firstObj) ? firstArr : firstObj;
  if (start === -1) return null;
  const openCh = text[start];
  const closeCh = openCh === "{" ? "}" : "]";
  const end = text.lastIndexOf(closeCh);
  if (end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** Small helpers for the routes. */
export function clampStr(v: unknown, max: number): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function clampStrList(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === "string")
    .map((x) => (x as string).trim().slice(0, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

/** Standard error JSON for the AI routes. */
export function aiError(res: Response, status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}
