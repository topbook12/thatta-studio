"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 4: সাউন্ড স্টুডিও (Sound Studio)
//
// One dialog, four studios:
//   🎵 মিউজিক    — procedural desi tunes per scene + loudness
//   🔊 SFX      — sound-effect library, auto-sync to beat actions
//   🎙 রেকর্ডিং  — record your own voice (mic) + noise cleanup
//   🎛 ভয়েস টিউন — per-character pitch (semitones) + rebuild voices
//
// Everything is 100% offline: music/SFX are synthesized in the
// browser, recordings live in IndexedDB, pitch shifts are pure PCM.
// ============================================================

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useStudio, activeEpisodeOf } from "@/lib/store";
import { MUSIC_TRACKS, musicUrl, musicTrackOf } from "@/lib/audio/music";
import { SFX_LIST, sfxDefOf, sfxUrl, AUTO_SFX_OF } from "@/lib/audio/sfx";
import { saveClip, loadClip, deleteClip, cleanUpRecording } from "@/lib/audio/clips";
import {
  cachedAudioFromBlob,
  clearCachedAudio,
  generateVoice,
  setCachedAudio,
} from "@/lib/tts-cache";
import type { SceneSfxEvent } from "@/lib/cartoon/types";
import type { CharacterDesign } from "@/lib/cartoon/types";
import {
  AudioLines,
  CircleStop,
  Mic,
  Music,
  Play,
  Plus,
  Square,
  Trash2,
  Volume2,
  Wand2,
  X,
} from "lucide-react";

const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** parent bumps audioVersion so timeline/durations refresh */
  onAudioChanged: () => void;
  /** current playhead (seconds) — SFX "+ যোগ" drops events here */
  playhead: number;
  /** audio-aware scene duration (music segments render this long) */
  sceneDuration: number;
}

type SfxDraft = {
  id: string;
  sfx: string;
  at: number;
  volume?: number;
  auto?: boolean;
  beatId?: string;
};

export default function SoundStudio({
  open,
  onOpenChange,
  onAudioChanged,
  playhead,
  sceneDuration,
}: Props) {
  const designs = useStudio((s) => s.designs);
  const updateDesign = useStudio((s) => s.updateDesign);
  const setSceneMusic = useStudio((s) => s.setSceneMusic);
  const setSceneMusicVolume = useStudio((s) => s.setSceneMusicVolume);
  const setSfxEvents = useStudio((s) => s.setSfxEvents);
  const scenes = useStudio((s) => s.scenes);
  const activeSceneId = useStudio((s) => s.activeSceneId);
  const episode = activeEpisodeOf({ scenes, activeSceneId });
  const scene = episode.scene;
  const audio = scene.audio;
  const currentMusic = audio?.music && audio.music !== "none" ? audio.music : null;
  const musicVolume = audio?.musicVolume ?? 0.55;
  const sfxEvents = audio?.sfx ?? [];

  // ---------- shared preview player ----------
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewing, setPreviewing] = useState<string | null>(null);

  const stopPreview = useCallback(() => {
    if (previewRef.current) {
      previewRef.current.pause();
      previewRef.current.onended = null;
      previewRef.current = null;
    }
    setPreviewing(null);
  }, []);

  useEffect(() => {
    if (!open) stopPreview();
  }, [open, stopPreview]);

  const playPreview = useCallback(
    async (kind: "music" | "sfx", id: string) => {
      stopPreview();
      setPreviewing(`${kind}:${id}`);
      try {
        const url =
          kind === "music" ? await musicUrl(id as never, sceneDuration) : await sfxUrl(id as never);
        if (!url) throw new Error("তৈরি করা যায়নি");
        const el = new Audio(url);
        previewRef.current = el;
        el.onended = () => {
          if (previewRef.current === el) {
            previewRef.current = null;
            setPreviewing(null);
          }
        };
        el.play().catch(() => setPreviewing(null));
      } catch {
        setPreviewing(null);
        toast({
          title: "প্রিভিউ চালানো যায়নি",
          description: "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
      }
    },
    [sceneDuration, stopPreview],
  );

  // ---------- tab 1: music ----------
  const [musicLoading, setMusicLoading] = useState<string | null>(null);

  const pickMusic = async (trackId: string | null) => {
    setMusicLoading(trackId ?? "none");
    try {
      if (trackId) await musicUrl(trackId as never, sceneDuration); // pre-render now
      setSceneMusic(trackId);
      toast({
        title: trackId ? "মিউজিক সেট হয়েছে 🎵" : "মিউজিক বন্ধ হয়েছে",
        description: trackId
          ? "প্লে করলেই এই সুর ব্যাকগ্রাউন্ডে বাজবে — এক্সপোর্টেও আসবে।"
          : "এই দৃশ্যে আর ব্যাকগ্রাউন্ড মিউজিক নেই।",
      });
    } finally {
      setMusicLoading(null);
    }
  };

  // ---------- tab 2: SFX ----------
  const addSfx = (sfxId: string, at?: number) => {
    const def = sfxDefOf(sfxId);
    if (!def) return;
    const evt: SceneSfxEvent = {
      id: `sfx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      sfx: sfxId,
      at: Math.max(0, Math.round((at ?? playhead) * 20) / 20),
      volume: 1,
    };
    setSfxEvents([...sfxEvents, evt]);
    onAudioChanged();
  };

  /** অটো-সিঙ্ক: every mapped action beat gets its matching SFX */
  const autoSyncSfx = () => {
    const existing = new Set(sfxEvents.map((e) => `${e.beatId ?? ""}|${e.sfx}`));
    const added: SfxDraft[] = [];
    for (const b of scene.beats) {
      const sfx = AUTO_SFX_OF(b.action);
      if (!sfx) continue;
      const key = `${b.id}|${sfx}`;
      if (existing.has(key)) continue;
      added.push({
        id: `sfx-${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${added.length}`,
        sfx,
        at: Math.max(0, Math.round((typeof b.start === "number" ? b.start : 0) * 20) / 20),
        volume: 1,
        auto: true,
        beatId: b.id,
      });
      existing.add(key);
    }
    if (added.length === 0) {
      toast({
        title: "নতুন কোনো অটো-SFX নেই",
        description: "থাপ্পড়/হাসি/দৌড়ের মতো অ্যাকশনের শব্দ আগেই যোগ হয়ে আছে।",
      });
      return;
    }
    setSfxEvents([...sfxEvents, ...added]);
    onAudioChanged();
    toast({
      title: `অটো-সিঙ্ক সম্পন্ন 🔊`,
      description: `${bnNum(added.length)}টি শব্দ অ্যাকশনের সময়ে বসানো হয়েছে (টেনে সময় বদলাতে পারবেন)।`,
    });
  };

  const updateSfxAt = (id: string, at: number) =>
    setSfxEvents(
      sfxEvents.map((e) =>
        e.id === id ? { ...e, at: Math.max(0, Math.round(at * 20) / 20) } : e,
      ),
    );

  const updateSfxVolume = (id: string, volume: number) =>
    setSfxEvents(
      sfxEvents.map((e) => (e.id === id ? { ...e, volume } : e)),
    );

  const removeSfx = (id: string) => {
    setSfxEvents(sfxEvents.filter((e) => e.id !== id));
    onAudioChanged();
  };

  // ---------- tab 3: recording ----------
  const spokenBeats = scene.beats;
  const [recTarget, setRecTarget] = useState<string>("");
  const [recState, setRecState] = useState<"idle" | "recording" | "done">("idle");
  const [recBlob, setRecBlob] = useState<Blob | null>(null);
  const [recUrl, setRecUrl] = useState<string>("");
  const [recDur, setRecDur] = useState(0);
  const [level, setLevel] = useState(0);
  const [cleanupOn, setCleanupOn] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const recStreamRef = useRef<MediaStream | null>(null);
  const recCtxRef = useRef<AudioContext | null>(null);
  const levelRafRef = useRef<number>(0);
  const chunksRef = useRef<Blob[]>([]);
  const recUrlRef = useRef<string>("");

  // beat clip inventory (IndexedDB) for the current scene
  const [clips, setClips] = useState<Record<string, { duration: number }>>({});
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const found: Record<string, { duration: number }> = {};
      for (const b of spokenBeats) {
        const c = await loadClip(b.id);
        if (c && alive) found[b.id] = { duration: c.duration };
      }
      if (alive) setClips(found);
    })();
    return () => {
      alive = false;
    };
  }, [open, spokenBeats]);

  const stopRecording = useCallback(() => {
    cancelAnimationFrame(levelRafRef.current);
    if (recRef.current?.state === "recording") recRef.current.stop();
    recStreamRef.current?.getTracks().forEach((t) => t.stop());
    recStreamRef.current = null;
    recCtxRef.current?.close().catch(() => {});
    recCtxRef.current = null;
  }, []);

  useEffect(() => {
    if (!open) {
      stopRecording();
      if (recUrlRef.current) {
        URL.revokeObjectURL(recUrlRef.current);
        recUrlRef.current = "";
      }
    }
  }, [open, stopRecording]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      recStreamRef.current = stream;
      // live level meter
      const AC: typeof AudioContext =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      recCtxRef.current = ctx;
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevel(peak);
        levelRafRef.current = requestAnimationFrame(tick);
      };
      levelRafRef.current = requestAnimationFrame(tick);

      chunksRef.current = [];
      const mime = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        setRecState("done");
        setLevel(0);
        const raw = new Blob(chunksRef.current, {
          type: mime ? mime.split(";")[0] : "audio/webm",
        });
        try {
          const out = cleanupOn
            ? await cleanUpRecording(raw)
            : { blob: raw, duration: 0 };
          const dur =
            out.duration > 0
              ? out.duration
              : (await cachedAudioFromBlob(out.blob)).duration;
          if (recUrlRef.current) URL.revokeObjectURL(recUrlRef.current);
          const url = URL.createObjectURL(out.blob);
          recUrlRef.current = url;
          setRecUrl(url);
          setRecBlob(out.blob);
          setRecDur(dur);
        } catch (e: unknown) {
          toast({
            title: "রেকর্ডিং প্রসেস করা যায়নি",
            description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
            variant: "destructive",
          });
          setRecState("idle");
        }
      };
      recRef.current = rec;
      rec.start();
      setRecState("recording");
      setRecBlob(null);
      setRecUrl("");
    } catch {
      toast({
        title: "মাইক্রোফোন পাওয়া যায়নি",
        description: "ব্রাউজারের মাইক পারমিশন দিন, তারপর আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    }
  };

  const cancelTake = () => {
    stopRecording();
    setRecState("idle");
    setRecBlob(null);
    setRecUrl("");
    setRecDur(0);
  };

  const assignRecording = async () => {
    const beat = spokenBeats.find((b) => b.id === recTarget);
    if (!beat || !recBlob) return;
    setAssigning(true);
    try {
      const cached = await cachedAudioFromBlob(recBlob);
      await saveClip(beat.id, recBlob, cached.duration);
      setCachedAudio(beat.id, cached);
      setClips((prev) => ({ ...prev, [beat.id]: { duration: cached.duration } }));
      onAudioChanged();
      toast({
        title: "নিজের গলা বসানো হয়েছে 🎙",
        description: `${beat.text.slice(0, 24)}… — এখন এই সংলাপে আপনার কণ্ঠই শোনাবে।`,
      });
      setRecState("idle");
      setRecBlob(null);
      setRecUrl("");
    } catch (e: unknown) {
      toast({
        title: "বসানো যায়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setAssigning(false);
    }
  };

  const removeRecording = async (beatId: string) => {
    await deleteClip(beatId);
    clearCachedAudio(beatId);
    setClips((prev) => {
      const next = { ...prev };
      delete next[beatId];
      return next;
    });
    onAudioChanged();
    toast({ title: "রেকর্ডিং মুছে ফেলা হয়েছে", description: "এখন আবার TTS ভয়েস ব্যবহার হবে।" });
  };

  // ---------- tab 4: voice tune ----------
  const [testingVoice, setTestingVoice] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState<string | null>(null);
  const testAudioRef = useRef<HTMLAudioElement | null>(null);

  const stopTest = () => {
    if (testAudioRef.current) {
      testAudioRef.current.pause();
      testAudioRef.current.onended = null;
      testAudioRef.current = null;
    }
    setTestingVoice(null);
  };

  const testTunedVoice = async (d: CharacterDesign) => {
    stopTest();
    setTestingVoice(d.id);
    try {
      const a = await generateVoice(
        `নমস্কার! আমি ${d.name}, এই কণ্ঠে কথা বলব।`,
        d.voice,
        1,
        d.voicePitch ?? 0,
      );
      const el = new Audio(a.url);
      testAudioRef.current = el;
      el.onended = () => setTestingVoice(null);
      el.play().catch(() => setTestingVoice(null));
    } catch {
      setTestingVoice(null);
      toast({ title: "নমুনা আসেনি", description: "আবার চেষ্টা করুন।", variant: "destructive" });
    }
  };

  /** re-generate every spoken line of ONE character with the new pitch */
  const rebuildPitched = async (d: CharacterDesign) => {
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
        description: "সংলাপ যোগ করার পর রিবিল্ড কাজ করবে।",
      });
      return;
    }
    setRebuilding(d.id);
    try {
      for (const b of targets) {
        const a = await generateVoice(b.text.trim(), d.voice, b.voiceSpeed ?? 1, d.voicePitch ?? 0);
        setCachedAudio(b.id, a);
      }
      onAudioChanged();
      toast({
        title: `${d.name} এর কণ্ঠ নতুন পিচে তৈরি 🎛`,
        description: `${bnNum(targets.length)}টি সংলাপ আপডেট হয়েছে।`,
      });
    } catch (e: unknown) {
      toast({
        title: "রিবিল্ড করা যায়নি",
        description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setRebuilding(null);
    }
  };

  const pitchLabel = (p: number) =>
    Math.abs(p) < 0.25
      ? "স্বাভাবিক"
      : p > 0
        ? `${bnNum(p)} সেমি-টোন উঁচু`
        : `${bnNum(Math.abs(p))} সেমি-টোন নিচু`;

  // ---------- render ----------
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-2xl border-amber-200">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-900">
            <AudioLines className="h-5 w-5 text-teal-700" />
            সাউন্ড স্টুডিও
            <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-medium text-teal-800">
              দৃশ্য: {episode.name}
            </span>
          </DialogTitle>
          <DialogDescription>
            মিউজিক, শব্দ-ইফেক্ট, নিজের গলা আর ভয়েস টিউনিং — সব এক জায়গায়, সবই অফলাইনে কাজ করে।
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="music" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="music" className="gap-1 text-xs">
              <Music className="h-3.5 w-3.5" /> মিউজিক
            </TabsTrigger>
            <TabsTrigger value="sfx" className="gap-1 text-xs">
              <Volume2 className="h-3.5 w-3.5" /> SFX
            </TabsTrigger>
            <TabsTrigger value="rec" className="gap-1 text-xs">
              <Mic className="h-3.5 w-3.5" /> রেকর্ড
            </TabsTrigger>
            <TabsTrigger value="tune" className="gap-1 text-xs">
              🎛 টিউন
            </TabsTrigger>
          </TabsList>

          {/* ---------------- music ---------------- */}
          <TabsContent value="music" className="mt-3 space-y-3">
            <div className="thatta-scroll max-h-[38vh] space-y-2 overflow-y-auto pr-1">
              {MUSIC_TRACKS.map((t) => {
                const active = currentMusic === t.id;
                const isPreviewing = previewing === `music:${t.id}`;
                return (
                  <div
                    key={t.id}
                    className={`flex items-center gap-2.5 rounded-xl border p-2.5 ${
                      active ? "border-teal-500 bg-teal-50" : "border-amber-200 bg-white"
                    }`}
                  >
                    <span className="text-xl" aria-hidden>
                      {t.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-amber-950">{t.name}</p>
                      <p className="truncate text-[11px] text-amber-700">{t.desc}</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 shrink-0 px-0"
                      onClick={() => (isPreviewing ? stopPreview() : playPreview("music", t.id))}
                      disabled={musicLoading === t.id}
                      aria-label={`${t.name} শুনুন`}
                    >
                      {isPreviewing ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      className={`h-8 shrink-0 text-xs ${
                        active ? "bg-teal-700 text-white hover:bg-teal-800" : "bg-orange-600 text-white hover:bg-orange-700"
                      }`}
                      onClick={() => (active ? pickMusic(null) : pickMusic(t.id))}
                      disabled={musicLoading === t.id || musicLoading === "none"}
                    >
                      {active ? "সরান" : "সেট করুন"}
                    </Button>
                  </div>
                );
              })}
              <div
                className={`flex items-center gap-2.5 rounded-xl border border-dashed p-2.5 ${
                  !currentMusic ? "border-teal-500 bg-teal-50" : "border-amber-300 bg-white"
                }`}
              >
                <span className="text-xl" aria-hidden>
                  🔇
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-amber-950">কোনো মিউজিক নেই</p>
                  <p className="text-[11px] text-amber-700">শুধু সংলাপ ও শব্দ-ইফেক্ট শোনাবে।</p>
                </div>
                {!currentMusic && (
                  <span className="rounded-full bg-teal-600 px-2 py-0.5 text-[10px] font-bold text-white">
                    চালু
                  </span>
                )}
              </div>
            </div>
            {currentMusic && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-bold text-amber-900">
                    ভলিউম — {bnNum(Math.round(musicVolume * 100))}%
                  </span>
                  <span className="text-[10px] text-amber-600">
                    {musicTrackOf(currentMusic)?.name}
                  </span>
                </div>
                <Slider
                  className="mt-2"
                  value={[Math.round(musicVolume * 100)]}
                  min={0}
                  max={100}
                  step={5}
                  onValueChange={(v) => setSceneMusicVolume(v[0] / 100)}
                  aria-label="মিউজিক ভলিউম"
                />
              </div>
            )}
          </TabsContent>

          {/* ---------------- SFX ---------------- */}
          <TabsContent value="sfx" className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                className="bg-teal-700 text-xs text-white hover:bg-teal-800"
                onClick={autoSyncSfx}
                title="থাপ্পড়/হাসি/দৌড়… অ্যাকশনের সাথে মিলিয়ে শব্দ বসায়"
              >
                <Wand2 className="mr-1.5 h-3.5 w-3.5" /> অটো-সিঙ্ক করুন
              </Button>
              <span className="text-[11px] text-amber-700">
                + বোতামে চাপলে প্লেহেডের সময়ে ({bnNum(playhead.toFixed(1))} সে.) শব্দ বসবে
              </span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {SFX_LIST.map((s) => {
                const isPreviewing = previewing === `sfx:${s.id}`;
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white p-1.5"
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                      onClick={() => (isPreviewing ? stopPreview() : playPreview("sfx", s.id))}
                      aria-label={`${s.name} শুনুন`}
                    >
                      <span aria-hidden>{s.emoji}</span>
                      <span className="truncate text-xs font-semibold text-amber-950">{s.name}</span>
                    </button>
                    <button
                      type="button"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-teal-600 text-white hover:bg-teal-700"
                      onClick={() => addSfx(s.id)}
                      title="প্লেহেডের সময়ে যোগ করুন"
                      aria-label={`${s.name} যোগ করুন`}
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-2.5">
              <p className="mb-1.5 text-xs font-bold text-amber-900">
                এই দৃশ্যের শব্দ-ইফেক্ট ({bnNum(sfxEvents.length)}টি)
              </p>
              {sfxEvents.length === 0 ? (
                <p className="text-[11px] text-amber-600">
                  এখনো নেই — উপর থেকে + চাপুন, বা অটো-সিঙ্ক চালান। টাইমলাইনের SFX সারিতে
                  টেনে সময় বদলানো যায়।
                </p>
              ) : (
                <div className="thatta-scroll max-h-36 space-y-1.5 overflow-y-auto pr-1">
                  {sfxEvents.map((e) => {
                    const def = sfxDefOf(e.sfx);
                    return (
                      <div
                        key={e.id}
                        className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2 py-1"
                      >
                        <span aria-hidden>{def?.emoji ?? "🔔"}</span>
                        <span className="w-24 shrink-0 truncate text-xs font-semibold text-amber-950">
                          {def?.name ?? e.sfx}
                          {e.auto && (
                            <span className="ml-1 rounded bg-teal-50 px-1 text-[9px] font-bold text-teal-700">
                              অটো
                            </span>
                          )}
                        </span>
                        <Input
                          type="number"
                          className="h-7 w-20 text-xs"
                          min={0}
                          step={0.1}
                          value={e.at}
                          onChange={(ev) => updateSfxAt(e.id, Number(ev.target.value) || 0)}
                          aria-label="শব্দের সময় (সেকেন্ড)"
                        />
                        <span className="text-[10px] text-amber-600">সে.</span>
                        <Slider
                          className="mx-1 flex-1"
                          value={[Math.round((e.volume ?? 1) * 100)]}
                          min={0}
                          max={150}
                          step={10}
                          onValueChange={(v) => updateSfxVolume(e.id, v[0] / 100)}
                          aria-label="শব্দের ভলিউম"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 w-7 shrink-0 border-rose-200 px-0 text-rose-700 hover:bg-rose-50"
                          onClick={() => removeSfx(e.id)}
                          aria-label="মুছুন"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ---------------- recording ---------------- */}
          <TabsContent value="rec" className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold text-amber-900">কোন সংলাপে বসাবেন:</span>
              <Select value={recTarget} onValueChange={setRecTarget}>
                <SelectTrigger className="h-8 min-w-[180px] flex-1 border-amber-200 text-xs">
                  <SelectValue placeholder="সংলাপ বাছুন" />
                </SelectTrigger>
                <SelectContent>
                  {spokenBeats.length === 0 && (
                    <SelectItem value="_none" disabled>
                      আগে দৃশ্য (বিট) যোগ করুন
                    </SelectItem>
                  )}
                  {spokenBeats.map((b, i) => {
                    const actor = designs.find(
                      (d) => d.id === scene.characters.find((c) => c.uid === b.actorUid)?.designId,
                    );
                    return (
                      <SelectItem key={b.id} value={b.id} className="text-xs">
                        {bnNum(i + 1)}. {actor?.name ?? "অজানা"} — {b.text.slice(0, 22) || "(সংলাপ নেই)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <div className="flex flex-wrap items-center gap-2.5">
                {recState !== "recording" ? (
                  <Button
                    size="sm"
                    className="bg-rose-600 text-white hover:bg-rose-700"
                    onClick={startRecording}
                    disabled={recState === "done"}
                  >
                    <Mic className="mr-1.5 h-4 w-4" />
                    {recState === "done" ? "রেকর্ড হয়ে গেছে" : "রেকর্ড শুরু"}
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" className="border-rose-300 text-rose-700" onClick={stopRecording}>
                    <CircleStop className="mr-1.5 h-4 w-4" /> থামান
                  </Button>
                )}
                {recState !== "idle" && (
                  <Button size="sm" variant="ghost" className="text-amber-700" onClick={cancelTake}>
                    বাতিল
                  </Button>
                )}
                <div className="flex items-center gap-1.5" title="লাইভ ভলিউম">
                  <div className="h-2.5 w-28 overflow-hidden rounded-full bg-amber-200">
                    <div
                      className="h-full rounded-full bg-teal-600 transition-[width] duration-75"
                      style={{ width: `${Math.round(Math.min(1, level) * 100)}%` }}
                    />
                  </div>
                  {recState === "recording" && (
                    <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-500" aria-label="রেকর্ড হচ্ছে" />
                  )}
                </div>
              </div>

              <div className="mt-2.5 flex items-center gap-2 text-xs">
                <Switch checked={cleanupOn} onCheckedChange={setCleanupOn} id="noise-cleanup" />
                <label htmlFor="noise-cleanup" className="text-amber-800">
                  নয়েজ ক্লিনআপ (হালকা শব্দ ও গুনগুন বাদ)
                </label>
              </div>

              {recState === "done" && recBlob && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 p-2">
                  <audio controls src={recUrl} className="h-8 max-w-[240px]" />
                  <span className="text-xs font-semibold text-teal-800">
                    {bnNum(recDur.toFixed(1))} সে.
                  </span>
                  <Button
                    size="sm"
                    className="ml-auto bg-teal-700 text-xs text-white hover:bg-teal-800"
                    onClick={assignRecording}
                    disabled={!recTarget || assigning}
                  >
                    {assigning ? "বসানো হচ্ছে..." : "বিটে বসান"}
                  </Button>
                </div>
              )}
            </div>

            <div className="rounded-xl border border-amber-200 bg-white p-2.5">
              <p className="mb-1.5 text-xs font-bold text-amber-900">
                নিজের গলার রেকর্ডিং ({bnNum(Object.keys(clips).length)}টি)
              </p>
              {Object.keys(clips).length === 0 ? (
                <p className="text-[11px] text-amber-600">
                  এখনো নেই — রেকর্ড করে বিটে বসালে সেটি প্রতিবার প্লে + এক্সপোর্টে আসবে (ডিভাইসে সেভ থাকে)।
                </p>
              ) : (
                <div className="thatta-scroll max-h-28 space-y-1.5 overflow-y-auto pr-1">
                  {spokenBeats
                    .filter((b) => clips[b.id])
                    .map((b, i) => {
                      const actor = designs.find(
                        (d) => d.id === scene.characters.find((c) => c.uid === b.actorUid)?.designId,
                      );
                      return (
                        <div
                          key={b.id}
                          className="flex items-center gap-2 rounded-lg border border-amber-200 px-2 py-1"
                        >
                          <Mic className="h-3.5 w-3.5 shrink-0 text-teal-700" />
                          <span className="min-w-0 flex-1 truncate text-xs text-amber-950">
                            {bnNum(i + 1)}. {actor?.name ?? "অজানা"} — {b.text.slice(0, 24) || "(সংলাপ নেই)"}{" "}
                            <span className="text-amber-600">({bnNum(clips[b.id].duration.toFixed(1))} সে.)</span>
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 border-rose-200 px-0 text-rose-700 hover:bg-rose-50"
                            onClick={() => removeRecording(b.id)}
                            aria-label="রেকর্ডিং মুছুন"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ---------------- voice tune ---------------- */}
          <TabsContent value="tune" className="mt-3">
            <div className="thatta-scroll max-h-[42vh] space-y-2 overflow-y-auto pr-1">
              {designs.length === 0 && (
                <p className="text-xs text-amber-700">আগে ক্যারেক্টার তৈরি করুন।</p>
              )}
              {designs.map((d) => (
                <div key={d.id} className="rounded-xl border border-amber-200 bg-white p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-[76px] truncate text-sm font-bold text-amber-950">
                      {d.name}
                    </span>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                      {pitchLabel(d.voicePitch ?? 0)}
                    </span>
                    <div className="ml-auto flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-teal-300 px-2 text-xs text-teal-800 hover:bg-teal-50"
                        onClick={() => (testingVoice === d.id ? stopTest() : testTunedVoice(d))}
                        disabled={testingVoice !== null && testingVoice !== d.id}
                        title="এই পিচে নমুনা শুনুন"
                      >
                        <Play className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-orange-300 px-2 text-xs text-orange-800 hover:bg-orange-50"
                        onClick={() => rebuildPitched(d)}
                        disabled={rebuilding === d.id}
                        title="এই ক্যারেক্টারের সব সংলাপ নতুন পিচে তৈরি করুন"
                      >
                        {rebuilding === d.id ? "হচ্ছে..." : "রিবিল্ড"}
                      </Button>
                    </div>
                  </div>
                  <Slider
                    className="mt-2"
                    value={[d.voicePitch ?? 0]}
                    min={-6}
                    max={6}
                    step={0.5}
                    onValueChange={(v) => updateDesign(d.id, { voicePitch: v[0] })}
                    aria-label={`${d.name} এর ভয়েস পিচ`}
                  />
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {[
                      { label: "বাচ্চা", v: 4 },
                      { label: "তরুণ", v: 2 },
                      { label: "স্বাভাবিক", v: 0 },
                      { label: "বুড়ো", v: -4 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          (d.voicePitch ?? 0) === p.v
                            ? "border-orange-600 bg-orange-600 text-white"
                            : "border-amber-200 bg-white text-amber-800 hover:bg-amber-100"
                        }`}
                        onClick={() => updateDesign(d.id, { voicePitch: p.v })}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <p className="text-[11px] leading-snug text-amber-600">
                টিপ: পিচ বদলানোর পর <b>রিবিল্ড</b> চাপলে সেই ক্যারেক্টারের সব সংলাপ নতুন
                পিচে তৈরি হবে। দৈর্ঘ্য একই থাকে, তাই লিপ-সিঙ্ক ঠিক থাকে।
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
