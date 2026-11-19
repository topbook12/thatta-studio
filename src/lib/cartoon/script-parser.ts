// ============================================================
// ঠাট্টা স্টুডিও — Phase 2: বাংলা স্ক্রিপ্ট পার্সার
//
// Paste a plain-text Bangla dialogue script and get auto-drafted
// beats (+ optional scene splits). Supported notation:
//
//   গোপাল: কী রে মন্ত্রী, কী করছিস?          → talk beat (actor গোপাল)
//   মন্ত্রী (রেগে): চুপ কর পাগলা!             → angry beat
//   (হাসছে)                                    → action-only direction
//   --- বাজারে গন্ডগোল ---                     → new scene marker
//   ## শেষ দৃশ্য                                → new scene marker
//
// Pure function — no store access, fully unit-testable.
// ============================================================

import type { ActionName } from './types';

/** One parsed line of the script. */
export interface ParsedLine {
  kind: 'dialogue' | 'direction';
  /** speaker name as written (dialogue only) */
  name?: string;
  /** parenthetical hint, e.g. "(রেগে)" */
  hint?: string;
  /** dialogue text (may be empty for directions) */
  text: string;
  /** auto-detected action from keywords */
  action: ActionName;
  /** estimated duration in seconds (audio can stretch it later) */
  duration: number;
}

export interface ParsedScene {
  /** scene name from a marker line, undefined → default name */
  name?: string;
  lines: ParsedLine[];
}

/** Action keyword map — first match wins. Keys are checked against the
 *  parenthetical hint AND the direction text (Bengali verb stems). */
const ACTION_KEYWORDS: { keys: string[]; action: ActionName }[] = [
  { keys: ['চাপরাস', 'ঘুষি', 'থাপ্পড়', 'মারল', 'মারছে'], action: 'slap' },
  { keys: ['লাথি'], action: 'kick' },
  { keys: ['ঠেল'], action: 'push' },
  { keys: ['হাস', 'হেস', 'কিল', 'ক্যাক'], action: 'laugh' },
  { keys: ['রাগ', 'রেগে', 'গর্জ'], action: 'angry' },
  { keys: ['দৌড়', 'ছুট'], action: 'run' },
  { keys: ['হাঁট', 'হেঁট', 'চলে যায়', 'চলে গেল'], action: 'walk' },
  { keys: ['লাফ', 'ঝাঁপ'], action: 'jump' },
  { keys: ['কাদ', 'কান্না', 'কাঁদ'], action: 'cry' },
  { keys: ['চমকে', 'অবাক', 'চিৎকার', 'হাঁ হাঁ'], action: 'surprise' },
  { keys: ['ভয়', 'কাঁপ', 'আতঙ্ক'], action: 'shiver' },
  { keys: ['নাচ', 'তালে তালে'], action: 'dance' },
  { keys: ['ঘুম', 'হু হু'], action: 'sleep' },
  { keys: ['ভাব', 'চিন্তা', 'মাথায় হাত'], action: 'think' },
  { keys: ['নমস্কার করে', 'প্রণাম', 'সালাম', 'মাথায় হাত দিয়ে বাহ'], action: 'bow' },
  { keys: ['তালি'], action: 'clap' },
  { keys: ['জয়', 'উদযাপন', 'খুশি হয়ে'], action: 'celebrate' },
  { keys: ['মিষ্টি খা', 'খাচ্ছে'], action: 'eat' },
  { keys: ['চুরি', 'টিপটো', 'লুকিয়ে'], action: 'sneak' },
  { keys: ['বোঝা', 'বইছে'], action: 'carry' },
  { keys: ['ইশারা', 'আঙুল তুলে', 'দেখাচ্ছে'], action: 'point' },
  { keys: ['হাত নাড়', 'হাত তুলে'], action: 'wave' },
  { keys: ['মাথা নাড়', 'সম্মত'], action: 'nod' },
  { keys: ['পড়ে গেল', 'পড়ে যায়', 'লুটিয়ে'], action: 'fall' },
  { keys: ['নাক ডাক'], action: 'sleep' },
  { keys: ['ঘুরে দাঁড়া', 'উল্টো দিকে'], action: 'turn' },
];

function detectAction(text: string, hint?: string): ActionName {
  const hay = `${hint ?? ''} ${text}`;
  for (const { keys, action } of ACTION_KEYWORDS) {
    for (const k of keys) {
      if (hay.includes(k)) return action;
    }
  }
  return 'talk';
}

/** Rough speaking-time estimate: Bangla ≈ 11 chars/second + padding. */
function estimateDuration(text: string, action: ActionName): number {
  const base = text.trim().length > 0 ? 1.4 + text.trim().length / 11 : 1.6;
  const floor =
    action === 'walk' || action === 'run'
      ? 2.4
      : action === 'fall' || action === 'dance'
        ? 2.6
        : 1.4;
  return Math.max(floor, Math.min(7, Math.round(base * 10) / 10));
}

const SPEAKER_BAD_CHARS = /[।!?.;,"'“”‘’০-৯0-9]/;

/** A scene-marker line: `--- নাম ---`, `## নাম`, `=== নাম ===` */
function matchSceneMarker(line: string): string | null {
  const m = line.match(/^\s*(?:---+|===+|##+\s*|\*\*\*+\s*)\s*(?:দৃশ্য\s*[:：]?\s*)?(.+?)\s*(?:---+|===+|\*\*\*+)?\s*$/);
  if (!m) return null;
  const name = m[1].trim();
  if (!name || name.length > 40) return null;
  // the line must START with the marker token, else it's just a sentence
  if (!/^\s*(?:---+|===+|##|\*\*\*+)/.test(line)) return null;
  return name;
}

/**
 * Parse a pasted script into scenes of parsed lines.
 * Tolerant by design: garbage lines are skipped, never thrown.
 */
export function parseScript(raw: string): ParsedScene[] {
  const scenes: ParsedScene[] = [];
  let cur: ParsedScene = { lines: [] };
  scenes.push(cur);
  let lastSpeaker: string | undefined;

  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    // scene marker?
    const marker = matchSceneMarker(line);
    if (marker) {
      cur = { name: marker, lines: [] };
      scenes.push(cur);
      continue;
    }

    // pure stage direction: "(হাসছে)" or "*হাসছে*"
    const dir = line.match(/^(?:\((.+)\)|\*(.+)\*)$/);
    if (dir) {
      const hint = (dir[1] ?? dir[2] ?? '').trim();
      const action = detectAction('', hint);
      cur.lines.push({
        kind: 'direction',
        text: '',
        hint,
        action,
        duration: estimateDuration('', action),
      });
      continue;
    }

    // dialogue: "Speaker (hint): text" — name must not contain parentheses,
    // so the optional (hint) group wins over the greedy name capture
    const dlg = line.match(/^([^:：()]{1,28})\s*(?:\(([^)]+)\))?\s*[:：]\s*(.+)$/);
    if (dlg) {
      const name = dlg[1].trim();
      const hint = dlg[2]?.trim();
      const text = dlg[3].trim();
      // speaker must look like a name, not a sentence fragment
      if (name.length >= 1 && !SPEAKER_BAD_CHARS.test(name)) {
        const action = detectAction(text, hint);
        cur.lines.push({
          kind: 'dialogue',
          name,
          hint,
          text,
          action,
          duration: estimateDuration(text, action),
        });
        lastSpeaker = name;
        continue;
      }
    }

    // fallback: bare line without a speaker — treat as last speaker's line
    if (lastSpeaker && line.length > 1) {
      const action = detectAction(line);
      cur.lines.push({
        kind: 'dialogue',
        name: lastSpeaker,
        text: line,
        action,
        duration: estimateDuration(line, action),
      });
    }
    // otherwise: ignored garbage line
  }

  // drop trailing empty scenes
  return scenes.filter((s) => s.lines.length > 0 || s.name);
}

export const SCRIPT_SAMPLE = `গোপাল: কী রে মন্ত্রী মশাই, রাজসভায় কী চালাচাল চলছে?
মন্ত্রী (রেগে): চুপ কর গোপাল! রাজার সামনে মুখ খুলছিস কেন?
গোপাল (হাসতে হাসতে): হা হা হা! রাজা তো আমার বন্ধু, কথা বললে কী হলো?
--- বাজারে গন্ডগোল ---
গোপাল: ওই দোকানদার, মিষ্টির ওজন কম দিচ্ছিস কেন?
দোকানদার (ভয়ে কাঁপতে কাঁপতে): না বাবা, আমি তো সাদামাটা মিষ্টিই দিই!
গোপাল (নমস্কার করে): কোনো ক্ষতি নেই ভাই, আবার দেখা হবে!`;
