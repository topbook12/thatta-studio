// ============================================================
// ঠাট্টা স্টুডিও — Ready-made scene templates (Phase 1, Day 1–10)
//
// Five one-click cartoon scenes a beginner can load, play and remix.
// Designs merge BY NAME with the user's existing cast: if the user
// already customized "গোপাল", the template uses THEIR গোপাল —
// otherwise the template's character is added once.
// Every beat gets fresh ids/uids, so loading twice never clashes.
// ============================================================

import { makeDesign, newId, normalizeScene, presetCast } from "./presets";
import type {
  ActionName,
  BgName,
  CharacterDesign,
  PlacedCharacter,
  PropName,
  Scene,
  SceneBeat,
} from "./types";

export interface TemplateMeta {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  bg: BgName;
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "bazaar",
    name: "বাজার কাণ্ড",
    emoji: "🏪",
    desc: "মিষ্টির দোকানে হিসাবের টানাপোড়েন — গোপালের মুখে ফাঁসার মজা",
    bg: "bazaar",
  },
  {
    id: "school",
    name: "স্কুল মজা",
    emoji: "🏫",
    desc: "কাক খাতা নিয়ে উড়ে গেছে! ক্লাসরুমে হাসির ঝড়",
    bg: "school",
  },
  {
    id: "river",
    name: "নদীর ধারে",
    emoji: "⛵",
    desc: "মাছ ধরার প্রতিযোগিতায় গোপাল ধরল পুরোনো বুট!",
    bg: "river",
  },
  {
    id: "rajcourt",
    name: "রাজসভার হাসি",
    emoji: "👑",
    desc: "রাজার কঠিন প্রশ্ন, গোপালের ঝাঁঝালো উত্তর — ক্লাসিক গোপাল ভাঁড়",
    bg: "rajcourt",
  },
  {
    id: "night",
    name: "রাতের ভয়",
    emoji: "🌙",
    desc: "অন্ধকারে ভূত-ভূত গল্প, শেষে বিড়ালের ঝলক — ভয় পেলেও হাসি",
    bg: "night",
  },
];

// ---------- small builders ----------

function place(
  d: CharacterDesign,
  x: number,
  scale: number,
  flip = false,
  prop: PropName = "none",
  z = 0,
): PlacedCharacter {
  return { uid: newId(), designId: d.id, x, scale, flip, prop, z: z || undefined };
}

function beat(
  actor: PlacedCharacter,
  action: ActionName,
  start: number,
  duration: number,
  text: string,
  extra: Partial<SceneBeat> = {},
): SceneBeat {
  return { id: newId(), actorUid: actor.uid, action, start, duration, text, ...extra };
}

/** one cinematic shot so every template shows off the camera system */
function shot(
  start: number,
  end: number,
  zoom: number,
  focusUid: string | null,
  panX?: number,
): Scene["camera"] {
  return {
    shots: [{ id: newId(), start, end, zoom, focusUid, panX }],
    shake: true,
  };
}

// ---------- template blueprints ----------

type ByName = (name: string) => CharacterDesign;

interface Blueprint {
  cast: () => CharacterDesign[];
  build: (byName: ByName) => Scene;
}

const BLUEPRINTS: Record<string, Blueprint> = {
  // ---------------- 1. বাজার কাণ্ড ----------------
  bazaar: {
    cast: () => [
      presetCast().find((c) => c.name === "গোপাল")!,
      presetCast().find((c) => c.name === "মশিমা")!,
      presetCast().find((c) => c.name === "মামা পুলিশ")!,
    ],
    build: (byName) => {
      const gopal = byName("গোপাল");
      const moshima = byName("মশিমা");
      const police = byName("মামা পুলিশ");
      const g = place(gopal, 28, 1.15, false, "laddu");
      const m = place(moshima, 66, 1.2, true, "pot");
      const p = place(police, 88, 1.28, true);
      return {
        background: "bazaar",
        characters: [g, m, p],
        camera: shot(9.6, 13.0, 1.4, p.uid),
        beats: [
          beat(g, "talk", 0, 3.2, "মশিমা, এক কেজি মিষ্টি দিন — স্বাদ দেখে দাম বাড়ব তো না?"),
          beat(m, "angry", 3.2, 3.4, "গোপাল! কালকের বাকি টাকা দিবি না, আজও ভাত খাবি? আগে হিসাব শোধ কর!"),
          beat(g, "think", 6.6, 3.0, "উঁহু... ভাবতে দিন — কাল বৃষ্টিতে হিসাবের বই ভিজে গিয়েছিল, মনে নেই?"),
          beat(p, "point", 9.6, 3.4, "ওই! বাজারে গোলমাল কী? গোপাল, তোর নাম শুনলেই আমার চোখ খট করে!"),
          beat(g, "bow", 13.0, 3.2, "মামা, আমি তো শুধু হিসাব মেলাচ্ছিলাম — মিষ্টির স্বাদে হিসাব মেলে না কেন!"),
          beat(m, "laugh", 16.2, 3.0, "হা হা! নাও, আজকের মিষ্টি ফ্রি — শুধু আর বাজারে বকবকা করিস না!"),
          beat(g, "celebrate", 19.2, 2.8, "জয় গোপাল! মিষ্টি ফ্রি, মন খুশি!"),
        ],
      };
    },
  },

  // ---------------- 2. স্কুল মজা ----------------
  school: {
    cast: () => [
      presetCast().find((c) => c.name === "গোপাল")!,
      presetCast().find((c) => c.name === "বন্ধু মিয়া")!,
    ],
    build: (byName) => {
      const gopal = byName("গোপাল");
      const mia = byName("বন্ধু মিয়া");
      const g = place(gopal, 30, 1.1, false, "book");
      const m = place(mia, 70, 1.25, true, "book");
      return {
        background: "school",
        characters: [g, m],
        camera: shot(3.2, 6.6, 1.35, g.uid),
        beats: [
          beat(m, "point", 0, 3.2, "গোপাল! কালকের অঙ্কের হোমওয়ার্ক খাতায় নেই — কোথায় গেল সেটা?"),
          beat(g, "talk", 3.2, 3.4, "মিয়াদি, হোমওয়ার্ক লিখতে লিখতে এক আাঁড়ি কাক খাতা নিয়ে উড়ে গেছে!"),
          beat(m, "angry", 6.6, 3.2, "কাক খাতা নিয়ে গেল? তাহলে তো কাকটাও তোর আগে প্রমোশন পাবে!"),
          beat(g, "shiver", 9.8, 3.0, "সত্যি দিদি! ওই কাকটা এখন মাস্টারমশাইয়ের চেয়ে বেশি অঙ্ক জানে!"),
          beat(m, "laugh", 12.8, 3.0, "হা হা হা! ঠিক আছে, আজ ছাড় — কাল অঙ্ক পুরো জমা দিতে হবে!"),
          beat(g, "dance", 15.8, 3.2, "ইসশ! কাক ভাইকে ধন্যবাদ — আজ ছুটির মজা!"),
          beat(m, "clap", 19.0, 2.6, "সবাই তালি দিন — গোপালের 'কাক-গল্প' এবারের সেরা গল্প!"),
        ],
      };
    },
  },

  // ---------------- 3. নদীর ধারে ----------------
  river: {
    cast: () => [
      presetCast().find((c) => c.name === "গোপাল")!,
      presetCast().find((c) => c.name === "দাদু")!,
    ],
    build: (byName) => {
      const gopal = byName("গোপাল");
      const dadu = byName("দাদু");
      const g = place(gopal, 26, 1.1, false, "basket", 40);
      const d = place(dadu, 72, 1.3, true, "stick", 80);
      return {
        background: "river",
        characters: [g, d],
        camera: shot(9.2, 12.2, 1.45, d.uid),
        beats: [
          beat(d, "talk", 0, 3.2, "গোপাল, মাছ ধরার প্রতিযোগিতা — যে বড় মাছ ধরবে, সেই সেরা!", { speed: 1 }),
          beat(g, "talk", 3.2, 3.0, "দাদু, আমার টোকরি দেখেন — মাছ না, পুরোনো বুট! নদীও আমার সাথে মজা করছে!"),
          beat(d, "laugh", 6.2, 3.0, "হা হা! বুট ধরলে বিচার হবে — নদীর মালিক কাকে বলবি?"),
          beat(g, "surprise", 9.2, 3.0, "উফ! দাদু, আপনার বাঁশের ফাঁদে তো পাহাড়সমান ইলিশ — ওই তো!"),
          beat(g, "fall", 12.2, 2.8, "আরে বাবা! ইলিশ দেখেই আমি তো নদীতেই পড়ে গেলাম!"),
          beat(d, "celebrate", 15.0, 3.0, "জয়! আজ ঘরে ভাত-ইলিশ ভুরিভোজ — গোপাল, উঠে এস!"),
          beat(g, "nod", 18.0, 2.8, "দাদু, কাল থেকে আমি বুট না — শুধু ইলিশ খুঁজব!"),
        ],
      };
    },
  },

  // ---------------- 4. রাজসভার হাসি ----------------
  rajcourt: {
    cast: () => [
      presetCast().find((c) => c.name === "গোপাল")!,
      // the king: দাদু's look + royal pagri + renamed
      (() => {
        const king = presetCast().find((c) => c.name === "দাদু")!;
        return makeDesign({
          ...king,
          id: newId(),
          name: "রাজা মশাই",
          headwearStyle: 3,
          headwearColor: "#a16207",
        });
      })(),
    ],
    build: (byName) => {
      const gopal = byName("গোপাল");
      const king = byName("রাজা মশাই");
      const g = place(gopal, 26, 1.1, false, "laddu");
      const k = place(king, 74, 1.35, true);
      return {
        background: "rajcourt",
        characters: [g, k],
        camera: shot(3.2, 6.6, 1.4, g.uid),
        beats: [
          beat(k, "point", 0, 3.2, "গোপাল ভাঁড়! রাজসভার প্রশ্ন — কী জিনিস যত বাঁটা যায়, তত বাড়ে?"),
          beat(g, "think", 3.2, 3.4, "রাজামশাই, ভাবছি... কুয়াশা? না না... আহা! জ্ঞান — যত বাঁটেন, তত বাড়ে!"),
          beat(k, "surprise", 6.6, 3.0, "সাবাশ! আরেক প্রশ্ন — রাত বারোটায় বাঘ ভয় দেখায়, কিন্তু কে ভয় পায় না?"),
          beat(g, "talk", 9.6, 3.2, "গোপাল! ভয় আমার পকেটে ফেলে রেখেছি — খুঁজলে পাবেন, মিষ্টির পাশেই!"),
          beat(k, "laugh", 12.8, 3.0, "হা হা হা! এমন ভাঁড় রাজসভায় আগে দেখিনি — পুরস্কার তার হাতে!"),
          beat(g, "celebrate", 15.8, 3.0, "জয় গোপাল! মিষ্টির থালা আর রাজার হাসি — দুটোই আজ আমার!"),
        ],
      };
    },
  },

  // ---------------- 5. রাতের ভয় ----------------
  night: {
    cast: () => [
      presetCast().find((c) => c.name === "গোপাল")!,
      presetCast().find((c) => c.name === "বন্ধু মিয়া")!,
    ],
    build: (byName) => {
      const gopal = byName("গোপাল");
      const mia = byName("বন্ধু মিয়া");
      const g = place(gopal, 30, 1.1, false, "lamp");
      const m = place(mia, 68, 1.2, true, "flower");
      return {
        background: "night",
        characters: [g, m],
        camera: shot(6.2, 9.4, 1.5, g.uid),
        beats: [
          beat(g, "talk", 0, 3.2, "মিয়াদি, আমি তো রাতের রাজা — অন্ধকারে একলা হাঁটতে ভয় কীসের!"),
          beat(m, "talk", 3.2, 3.0, "তাহলে শোন, ওই গাছের ঝিলমিল শব্দটা কী — শুনছ তো?"),
          beat(g, "shiver", 6.2, 3.2, "ত-ত-তো শুনছি! ভ-ভূত নাকি? আমার তো হাত-পা ঠান্ডা হয়ে গেল!"),
          beat(m, "laugh", 9.4, 3.0, "হা হা! ভূত নয় গোপাল — পুরোনো কুপিতে বিড়াল ঘুমাচ্ছে, ওই দেখো!"),
          beat(g, "turn", 12.4, 3.0, "উফ! বিড়ালের জন্য এত ভয় — আমার বুদ্ধি আজ ছুটিতে ছিল!"),
          beat(m, "walk", 15.4, 3.2, "চলো, কুপিটা নিয়ে বাড়ি যাই — পথ দুটো একসাথে ভালো লাগে!", { moveTo: 60, easing: "easeInOut" }),
          beat(g, "nod", 18.6, 2.6, "হুম! ভয়কে যেতে দিলাম, বন্ধু নিয়ে হাঁটার মজাটা রইল!"),
        ],
      };
    },
  },
};

// ---------- public API ----------

export interface AppliedTemplate {
  designs: CharacterDesign[];
  scene: Scene;
}

/**
 * Merge a template into the current cast: existing designs with the same
 * name are reused (user tweaks survive), missing ones are added once.
 * Returns null for an unknown template id.
 */
export function applyTemplate(
  currentDesigns: CharacterDesign[],
  templateId: string,
): AppliedTemplate | null {
  const blueprint = BLUEPRINTS[templateId];
  if (!blueprint) return null;

  const designs = [...currentDesigns];
  const byName: ByName = (name) => {
    const existing = designs.find((d) => d.name === name);
    if (existing) return existing;
    const fresh = blueprint.cast().find((d) => d.name === name);
    if (!fresh) return makeDesign({ name });
    designs.push(fresh);
    return fresh;
  };

  const scene = blueprint.build(byName);
  return { designs, scene: normalizeScene(scene) };
}
