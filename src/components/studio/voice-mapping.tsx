"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 2: ক্যারেক্টার-ভয়েস ম্যাপিং
//
// One place to see WHO speaks with WHICH voice across the whole
// episode: change the mapping, audition a sample line, and rebuild
// the generated voices so every existing beat re-records instantly.
// ============================================================

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useStudio } from "@/lib/store";
import { VOICE_OPTIONS } from "@/lib/cartoon/presets";
import { generateVoice, setCachedAudio } from "@/lib/tts-cache";
import type { CharacterDesign } from "@/lib/cartoon/types";
import { Mic, RefreshCw, Volume2 } from "lucide-react";

const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

export default function VoiceMapping({
  onAudioChanged,
}: {
  /** parent bumps its audioVersion so timeline/durations refresh */
  onAudioChanged: () => void;
}) {
  const designs = useStudio((s) => s.designs);
  const updateDesign = useStudio((s) => s.updateDesign);
  const [testing, setTesting] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopTest = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
  };

  const testVoice = async (d: CharacterDesign) => {
    stopTest();
    setTesting(d.id);
    try {
      const audio = await generateVoice(
        `নমস্কার! আমি ${d.name}, এই কণ্ঠে কথা বলব।`,
        d.voice,
        1,
      );
      const el = new Audio(audio.url);
      audioRef.current = el;
      el.onended = () => setTesting(null);
      el.play().catch(() => setTesting(null));
    } catch (e: unknown) {
      setTesting(null);
      toast({
        title: "নমুনা কণ্ঠ আসেনি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    }
  };

  /** re-generate every spoken beat of ONE character (all scenes) */
  const rebuildFor = async (d: CharacterDesign) => {
    const st = useStudio.getState();
    const targets = st.scenes.flatMap((es) =>
      es.scene.beats.filter((b) => {
        if (!b.text.trim()) return false;
        const placed = es.scene.characters.find((c) => c.uid === b.actorUid);
        return placed?.designId === d.id;
      }),
    );
    if (targets.length === 0) {
      toast({
        title: `${d.name} এর কোনো সংলাপ নেই`,
        description: "এই ক্যারেক্টারের বিটে সংলাপ লিখলে ভয়েস হবে।",
      });
      return;
    }
    setRebuilding(d.id);
    try {
      for (const b of targets) {
        const audio = await generateVoice(b.text, d.voice, b.voiceSpeed ?? 1);
        setCachedAudio(b.id, audio);
      }
      onAudioChanged();
      toast({
        title: `${d.name} এর ভয়েস নতুন করে তৈরি 🔊`,
        description: `${bnNum(targets.length)}টি সংলাপ নতুন কণ্ঠে রেকর্ড হয়েছে।`,
      });
    } catch (e: unknown) {
      toast({
        title: "ভয়েস রিবিল্ড করা যায়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setRebuilding(null);
    }
  };

  return (
    <Card className="border-amber-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-orange-800">🗣 ভয়েস ম্যাপিং</CardTitle>
        <p className="text-xs font-normal leading-snug text-amber-700">
          কোন ক্যারেক্টার কোন কণ্ঠে কথা বলবে — সব দৃশ্যে একই কণ্ঠ থাকবে।
          বদলানোর পর <b>রিবিল্ড</b> চাপলে পুরো এপিসোডের সংলাপ নতুন কণ্ঠে হবে।
        </p>
      </CardHeader>
      <CardContent className="space-y-2.5">
        {designs.length === 0 && (
          <p className="text-xs text-amber-700">আগে ক্যারেক্টার তৈরি করুন।</p>
        )}
        {designs.map((d) => (
          <div
            key={d.id}
            className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-white p-2"
          >
            <span className="min-w-[72px] max-w-[110px] truncate text-xs font-bold text-amber-950">
              {d.name}
            </span>
            <Select
              value={d.voice}
              onValueChange={(v) => updateDesign(d.id, { voice: v })}
            >
              <SelectTrigger className="h-8 min-w-[150px] flex-1 border-amber-200 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VOICE_OPTIONS.map((o) => (
                  <SelectItem key={o.id} value={o.id} className="text-xs">
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 border-teal-300 px-2 text-teal-800 hover:bg-teal-50"
              onClick={() => testVoice(d)}
              disabled={testing === d.id}
              title="নমুনা শুনুন"
              aria-label={`${d.name} এর কণ্ঠ শুনুন`}
            >
              <Mic className="h-3.5 w-3.5" />
              {testing === d.id ? "শোনা হচ্ছে..." : ""}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 shrink-0 border-orange-300 px-2 text-orange-800 hover:bg-orange-50"
              onClick={() => rebuildFor(d)}
              disabled={rebuilding === d.id}
              title="এই ক্যারেক্টারের সব সংলাপ নতুন কণ্ঠে তৈরি করুন"
              aria-label={`${d.name} এর ভয়েস রিবিল্ড`}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${rebuilding === d.id ? "animate-spin" : ""}`} />
              {rebuilding === d.id ? "হচ্ছে..." : "রিবিল্ড"}
            </Button>
          </div>
        ))}
        <p className="flex items-start gap-1.5 text-[11px] leading-snug text-amber-600">
          <Volume2 className="mt-0.5 h-3 w-3 shrink-0" />
          টিপ: নতুন বিট লেখার পর উপরের <b>সব ভয়েস জেনারেট</b> বোতাম চাপলে সব
          ক্যারেক্টারের সংলাপ একবারে তৈরি হয়।
        </p>
      </CardContent>
    </Card>
  );
}
