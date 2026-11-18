"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 3: দুই-ক্যারেক্টার ইন্টারঅ্যাকশন প্রিসেট
//
// Pick two characters + a preset choreography (slap reaction, chase,
// greeting…) → the beats are appended at the end of the CURRENT scene
// with comic-impact timing. One click = a whole mini-sketch.
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useStudio } from "@/lib/store";
import { INTERACTION_PRESETS, buildInteractionBeats } from "@/lib/cartoon/interactions";
import { getCachedAudio } from "@/lib/tts-cache";
import type { SceneBeat } from "@/lib/cartoon/types";
import { Theater } from "lucide-react";

const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

export default function InteractionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const scenes = useStudio((s) => s.scenes);
  const activeSceneId = useStudio((s) => s.activeSceneId);
  const designs = useStudio((s) => s.designs);
  const addBeat = useStudio((s) => s.addBeat);

  const scene = useMemo(
    () => (scenes.find((es) => es.id === activeSceneId) ?? scenes[0]).scene,
    [scenes, activeSceneId],
  );

  const [aUid, setAUid] = useState("");
  const [bUid, setBUid] = useState("");

  const effectiveDur = (b: SceneBeat) => {
    const a = getCachedAudio(b.id);
    return Math.max(0.3, a ? Math.max(b.duration, a.duration + 0.3) : b.duration);
  };
  const sceneEnd = useMemo(
    () =>
      scene.beats.reduce(
        (max, b) => Math.max(max, (b.start ?? 0) + effectiveDur(b)),
        0,
      ),
    [scene.beats],
  );

  const apply = (presetId: string) => {
    const preset = INTERACTION_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    const A = aUid || scene.characters[0]?.uid;
    const B =
      bUid || scene.characters.find((c) => c.uid !== A)?.uid;
    if (!A || !B) {
      toast({
        title: "দুজন ক্যারেক্টার দরকার",
        description:
          "মঞ্চে অন্তত দুজন ক্যারেক্টার রাখুন, তারপর ইন্টারঅ্যাকশন বসান।",
        variant: "destructive",
      });
      return;
    }
    if (A === B) {
      toast({
        title: "একই ক্যারেক্টার দুবার",
        description: "কে কার সাথে অভিনয় করবে — দুজন আলাদা বাছুন।",
        variant: "destructive",
      });
      return;
    }
    const beats = buildInteractionBeats(preset, A, B, sceneEnd + 0.2);
    // same-tick loop → history coalesces into ONE undo step
    for (const b of beats) addBeat(b);
    toast({
      title: `${preset.emoji} ${preset.name} বসানো হয়েছে!`,
      description: `${bnNum(beats.length)}টি নতুন বিট — ${bnNum(
        (sceneEnd + 0.2).toFixed(1),
      )} সে. থেকে শুরু। প্লে করে দেখুন!`,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-orange-800">
            🤝 দুই-ক্যারেক্টার ইন্টারঅ্যাকশন
          </DialogTitle>
          <DialogDescription>
            রেডিমেড জুটি-দৃশ্য — বাছুন কে কার সাথে, এক ক্লিকে পুরো ছোট-স্কেচ
            টাইমলাইনের শেষে বসে যাবে।
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-amber-900">
              🅰️ শুরু করবে (আক্রমণকারী/উদ্যোক্তা)
            </label>
            <Select value={aUid} onValueChange={setAUid}>
              <SelectTrigger className="border-amber-300">
                <SelectValue placeholder="ক্যারেক্টার বাছুন" />
              </SelectTrigger>
              <SelectContent>
                {scene.characters.map((c) => (
                  <SelectItem key={c.uid} value={c.uid}>
                    {designs.find((d) => d.id === c.designId)?.name ?? "অজানা"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-amber-900">
              🅱️ জুড়ি (রিয়াকশন দেবে)
            </label>
            <Select value={bUid} onValueChange={setBUid}>
              <SelectTrigger className="border-amber-300">
                <SelectValue placeholder="ক্যারেক্টার বাছুন" />
              </SelectTrigger>
              <SelectContent>
                {scene.characters.map((c) => (
                  <SelectItem key={c.uid} value={c.uid}>
                    {designs.find((d) => d.id === c.designId)?.name ?? "অজানা"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="thatta-scroll max-h-72 space-y-2 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/40 p-2.5 pr-1">
          {INTERACTION_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => apply(p.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-amber-200 bg-white p-2.5 text-left transition-colors hover:border-orange-400 hover:bg-orange-50"
            >
              <span className="text-2xl" aria-hidden>
                {p.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-amber-950">
                  {p.name}
                  <span className="ml-2 text-[11px] font-medium text-amber-600">
                    ~{bnNum(p.length.toFixed(1))} সে.
                  </span>
                </span>
                <span className="block truncate text-xs text-amber-700">
                  {p.desc}
                </span>
              </span>
            </button>
          ))}
        </div>

        <p className="flex items-center gap-1.5 text-[11px] text-amber-600">
          <Theater className="h-3.5 w-3.5" />
          নতুন বিটগুলো বর্তমান দৃশ্যের শেষ সময় থেকে বসবে — টাইমলাইনে টেনে ফিনিশিং
          টাচ দিন।
        </p>
      </DialogContent>
    </Dialog>
  );
}
