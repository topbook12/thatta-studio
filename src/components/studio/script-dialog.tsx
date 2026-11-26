"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 2: স্ক্রিপ্ট পেস্ট → অটো-বিট
//
// Paste a Bangla dialogue script, see it parsed into beats with
// speakers auto-matched to the cast (editable), then apply: scene 1
// fills the CURRENT scene, `--- দৃশ্য ---` markers become new scenes.
// ============================================================

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useStudio } from "@/lib/store";
import { freshEpisodeScene, newId, normalizeScene, nextSceneName } from "@/lib/cartoon/presets";
import { parseScript, SCRIPT_SAMPLE } from "@/lib/cartoon/script-parser";
import { ACTION_OPTIONS } from "@/lib/cartoon/presets";
import { MAX_SCENES } from "@/components/studio/scene-strip";
import type { ActionName, EpisodeScene } from "@/lib/cartoon/types";
import { FileText, Sparkles } from "lucide-react";

const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

interface Row {
  key: string;
  name?: string;
  hint?: string;
  text: string;
  action: ActionName;
  duration: number;
  designId: string | null;
}

interface SceneBlock {
  name?: string;
  rows: Row[];
}

export default function ScriptDialog({
  open,
  onOpenChange,
  /** Phase 9 — AI copilot hands its draft over through this prop */
  initialText,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialText?: string;
}) {
  const designs = useStudio((s) => s.designs);
  const scenes = useStudio((s) => s.scenes);
  const activeSceneId = useStudio((s) => s.activeSceneId);
  const loadEpisodes = useStudio((s) => s.loadEpisodes);

  const [raw, setRaw] = useState("");
  const [blocks, setBlocks] = useState<SceneBlock[] | null>(null);

  // Phase 9 — when the AI copilot sends a new draft, pre-fill the editor.
  // React docs pattern: adjust state when a prop changes (render time,
  // guarded by a prev-value snapshot — no effect needed).
  const [prevInitial, setPrevInitial] = useState<string | null>(initialText ?? null);
  if ((initialText ?? null) !== prevInitial) {
    setPrevInitial(initialText ?? null);
    if (initialText && initialText.trim()) {
      setRaw(initialText);
      setBlocks(null);
    }
  }

  const parsed = useMemo(() => (raw.trim() ? parseScript(raw) : null), [raw]);

  const buildPreview = () => {
    if (!parsed || parsed.every((s) => s.lines.length === 0)) {
      toast({
        title: "স্ক্রিপ্ট বুঝতে পারা গেল না",
        description:
          "প্রতিটি লাইন 'নাম: সংলাপ' এই ফরম্যাটে লিখুন — যেমন: গোপাল: কী রে মামা?",
        variant: "destructive",
      });
      return;
    }
    const blocks: SceneBlock[] = [];
    for (const sc of parsed) {
      if (sc.lines.length === 0) continue;
      blocks.push({
        name: sc.name,
        rows: sc.lines.map((l, i) => ({
          key: `${blocks.length}-${i}`,
          name: l.name,
          hint: l.hint,
          text: l.text,
          action: l.action,
          duration: l.duration,
          // auto-match speaker to a cast member by name
          designId: matchDesign(l.name ?? "", designs),
        })),
      });
    }
    setBlocks(blocks);
  };

  const applyScript = () => {
    if (!blocks) return;
    const st = useStudio.getState();
    const activeEs =
      st.scenes.find((es) => es.id === st.activeSceneId) ?? st.scenes[0];

    const totalScenes = blocks.length;
    const roomForNew = Math.max(0, MAX_SCENES - st.scenes.length + 1); // +1: first block replaces the active scene
    if (totalScenes > roomForNew) {
      toast({
        title: "দৃশ্যের সীমা ছাড়িয়ে যাচ্ছে",
        description: `এক এপিসোডে সর্বোচ্চ ${bnNum(MAX_SCENES)}টি দৃশ্য — শেষ ${bnNum(
          totalScenes - roomForNew,
        )}টি স্ক্রিপ্ট দৃশ্য বাদ পড়বে।`,
        variant: "destructive",
      });
    }
    const kept = blocks.slice(0, roomForNew);

    // sequential timeline per scene — cast grows automatically if the
    // script names a character that isn't standing on the stage yet
    const placedChars = [...activeEs.scene.characters];
    const uidOfDesign = (designId: string | null): string => {
      if (designId) {
        const found = placedChars.find((c) => c.designId === designId);
        if (found) return found.uid;
        const count = placedChars.length;
        const placed = {
          uid: newId(),
          designId,
          x: count === 0 ? 30 : Math.min(85, 20 + count * 18),
          scale: 1.1,
          flip: false,
        };
        placedChars.push(placed);
        return placed.uid;
      }
      if (placedChars[0]) return placedChars[0].uid;
      return "";
    };
    const buildBeats = (rows: Row[]) => {
      let acc = 0;
      return rows.map((r) => {
        const start = Math.round(acc * 20) / 20;
        acc += r.duration;
        return {
          id: newId(),
          actorUid: uidOfDesign(r.designId),
          action: r.action,
          start,
          duration: r.duration,
          text: r.text,
        };
      });
    };
    const withCast = () => normalizeScene({
      ...activeEs.scene,
      characters: placedChars.map((c) => ({ ...c })),
    });

    const newScenes: EpisodeScene[] = st.scenes.map((es) => {
      if (es.id !== st.activeSceneId) return es;
      const beats = kept[0] ? buildBeats(kept[0].rows) : es.scene.beats;
      return {
        ...es,
        scene: normalizeScene({ ...withCast(), beats }),
      };
    });

    for (let i = 1; i < kept.length; i++) {
      const fresh = freshEpisodeScene(
        kept[i].name ?? nextSceneName(newScenes),
        withCast(),
      );
      fresh.scene = normalizeScene({
        ...fresh.scene,
        beats: buildBeats(kept[i].rows),
      });
      // insert right after the previously inserted one (keep order)
      const at = newScenes.findIndex((es) => es.id === st.activeSceneId);
      newScenes.splice(at + i, 0, fresh);
    }

    loadEpisodes(newScenes, st.designs, st.activeSceneId);

    const totalBeats = kept.reduce((n, b) => n + b.rows.length, 0);
    toast({
      title: "স্ক্রিপ্ট থেকে দৃশ্য তৈরি হয়েছে 📜",
      description: `${bnNum(totalBeats)}টি বিট • ${bnNum(kept.length)}টি দৃশ্য — টাইমলাইনে গিয়ে সময় ও ভয়েস ঠিক করুন।`,
    });
    setBlocks(null);
    setRaw("");
    onOpenChange(false);
  };

  const unmatched = blocks
    ? blocks.flatMap((b) => b.rows).filter((r) => !r.designId).length
    : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setBlocks(null);
      }}
    >
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-orange-800">
            📜 স্ক্রিপ্ট পেস্ট করুন — অটো দৃশ্য তৈরি
          </DialogTitle>
          <DialogDescription>
            বাংলা সংলাপ <code className="rounded bg-amber-100 px-1">নাম: সংলাপ</code>{" "}
            ফরম্যাটে লিখুন। <b>(রেগে)</b>, <b>(হাসতে হাসতে)</b> — বন্ধনীতে ভাব দিলে
            সেই অ্যাকশন বসবে। <code className="rounded bg-amber-100 px-1">--- দৃশ্যের নাম ---</code>{" "}
            লিখলে নতুন দৃশ্য খুলবে!
          </DialogDescription>
        </DialogHeader>

        {!blocks ? (
          <div className="space-y-3">
            <Textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={9}
              placeholder={SCRIPT_SAMPLE}
              className="border-amber-300 font-mono text-sm focus-visible:ring-orange-400"
              aria-label="স্ক্রিপ্ট"
            />
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRaw(SCRIPT_SAMPLE)}
                className="border-amber-300 text-xs"
              >
                <FileText className="mr-1.5 h-3.5 w-3.5" /> নমুনা বসান
              </Button>
              {parsed && (
                <p className="text-xs font-semibold text-amber-700">
                  পাওয়া গেছে: {bnNum(parsed.reduce((n, s) => n + s.lines.length, 0))}টি লাইন •{" "}
                  {bnNum(parsed.filter((s) => s.lines.length > 0).length)}টি দৃশ্য
                </p>
              )}
              <Button
                onClick={buildPreview}
                className="bg-orange-600 text-white hover:bg-orange-700"
                disabled={!raw.trim()}
              >
                <Sparkles className="mr-2 h-4 w-4" /> পার্স করে দেখান
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="thatta-scroll max-h-[46vh] space-y-3 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/40 p-3 pr-1">
              {blocks.map((b, bi) => (
                <div key={bi} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs font-bold text-white">
                      {bnNum(bi + 1)}
                    </span>
                    {b.name ? (
                      <span className="text-sm font-bold text-amber-900">{b.name}</span>
                    ) : (
                      <span className="text-xs text-amber-600">
                        (বর্তমান দৃশ্যে বসবে)
                      </span>
                    )}
                    {bi === 0 && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        এই দৃশ্যের বিটগুলো বদলে বসবে
                      </span>
                    )}
                    {bi > 0 && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                        নতুন দৃশ্য
                      </span>
                    )}
                  </div>
                  {b.rows.map((r) => (
                    <div
                      key={r.key}
                      className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white p-2"
                    >
                      <span
                        className="min-w-[64px] max-w-[124px] truncate text-xs font-bold text-amber-950"
                        title={r.hint ? `${r.name} (${r.hint})` : r.name}
                      >
                        {r.name}
                        {r.hint ? ` (${r.hint})` : ""}
                      </span>
                      <span className="shrink-0 text-sm" title={r.action}>
                        {ACTION_OPTIONS.find((a) => a.id === r.action)?.emoji ?? "🎬"}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs text-amber-800">
                        {r.text || "(সংলাপ ছাড়া অভিনয়)"}
                      </span>
                      <Select
                        value={r.designId ?? "__none"}
                        onValueChange={(v) => {
                          const id = v === "__none" ? null : v;
                          setBlocks((prev) =>
                            prev
                              ? prev.map((blk) => ({
                                  ...blk,
                                  rows: blk.rows.map((row) =>
                                    row.key === r.key ? { ...row, designId: id } : row,
                                  ),
                                }))
                              : prev,
                          );
                        }}
                      >
                        <SelectTrigger className="h-8 w-[150px] border-amber-200 text-xs">
                          <SelectValue placeholder="ক্যারেক্টার বাছুন" />
                        </SelectTrigger>
                        <SelectContent>
                          {designs.map((d) => (
                            <SelectItem key={d.id} value={d.id} className="text-xs">
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                  <Input
                    value={b.name ?? ""}
                    onChange={(e) => {
                      const name = e.target.value;
                      setBlocks((prev) =>
                        prev
                          ? prev.map((blk, i) =>
                              i === bi ? { ...blk, name } : blk,
                            )
                          : prev,
                      );
                    }}
                    maxLength={40}
                    placeholder="দৃশ্যের নাম (ঐচ্ছিক)"
                    className="h-8 w-56 border-amber-200 text-xs"
                    aria-label="দৃশ্যের নাম"
                  />
                </div>
              ))}
            </div>
            {unmatched > 0 && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                ⚠️ {bnNum(unmatched)}টি লাইনের ক্যারেক্টার অমিল — উপরে বাছুন, নইলে
                প্রথম ক্যারেক্টার অভিনয় করবে।
              </p>
            )}
            <div className="flex justify-between gap-2">
              <Button variant="outline" onClick={() => setBlocks(null)}>
                ← আবার এডিট করুন
              </Button>
              <Button
                onClick={applyScript}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                ✅ দৃশ্য তৈরি করুন
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** fuzzy speaker→design match: exact → one contains the other */
function matchDesign(
  name: string,
  designs: { id: string; name: string }[],
): string | null {
  if (!name) return null;
  const exact = designs.find((d) => d.name === name);
  if (exact) return exact.id;
  const partial = designs.find(
    (d) => d.name.includes(name) || name.includes(d.name),
  );
  return partial?.id ?? null;
}
