"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import {
  ACTION_OPTIONS,
  BG_OPTIONS,
  EASING_OPTIONS,
  PROP_OPTIONS,
  SPEED_OPTIONS,
  VOICE_SPEED_OPTIONS,
} from "@/lib/cartoon/presets";
import { CartoonStage } from "@/lib/cartoon/engine";
import { getCachedAudio, generateVoice, setCachedAudio } from "@/lib/tts-cache";
import type {
  ActionName,
  CharacterDesign,
  EasingName,
  PropName,
  Scene,
  SceneBeat,
} from "@/lib/cartoon/types";
import TimelineEditor, {
  type TimelineActor,
  type TimelineBeat,
} from "@/components/studio/timeline-editor";
import {
  ArrowDown,
  ArrowUp,
  Download,
  FolderOpen,
  Mic,
  Pause,
  Pencil,
  Play,
  Save,
  Square,
  Trash2,
  UserPlus,
  Video,
  Volume2,
  X,
} from "lucide-react";

interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: string;
}

const bnNum = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

/** ক্যারেক্টারপ্রতি টাইমলাইনের রঙ (টাইমলাইন ব্লক + রো) */
const ACTOR_COLORS = [
  "#ea580c",
  "#0d9488",
  "#7c3aed",
  "#dc2626",
  "#15803d",
  "#b45309",
  "#be185d",
  "#4d7c0f",
];

function actorColorOf(uid: string, characters: { uid: string }[]): string {
  const idx = characters.findIndex((c) => c.uid === uid);
  return ACTOR_COLORS[(idx >= 0 ? idx : 0) % ACTOR_COLORS.length];
}

function pickMime(): { mime: string; ext: string } {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  if (typeof MediaRecorder === "undefined") return { mime: "", ext: "webm" };
  for (const m of candidates) {
    if (MediaRecorder.isTypeSupported(m)) {
      return { mime: m, ext: m.startsWith("video/mp4") ? "mp4" : "webm" };
    }
  }
  return { mime: "", ext: "webm" };
}

export default function StudioTab({
  onOpenCreator,
}: {
  onOpenCreator?: () => void;
}) {
  const {
    designs,
    scene,
    setBackground,
    addPlaced,
    updatePlaced,
    removePlaced,
    addBeat,
    updateBeat,
    removeBeat,
    moveBeat,
    moveBeatTo,
    setDesigns,
    setScene,
    addCameraShot,
    updateCameraShot,
    removeCameraShot,
    setCameraShake,
  } = useStudio();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<CartoonStage | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const destRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const exportingRef = useRef(false);
  const editorCardRef = useRef<HTMLDivElement | null>(null);
  const playingAudioRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const selectedBeatIdRef = useRef<string | null>(null);
  const rateRef = useRef(1);
  const lastTimePushRef = useRef(0);

  const [playing, setPlaying] = useState(false);
  const [activeBeatIds, setActiveBeatIds] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioVersion, setAudioVersion] = useState(0);
  const [genBusyId, setGenBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // beat editor state
  const [editingBeatId, setEditingBeatId] = useState<string | null>(null);
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [actorUid, setActorUid] = useState("");
  const [action, setAction] = useState<ActionName>("talk");
  const [duration, setDuration] = useState(3);
  const [text, setText] = useState("");
  const [moveTo, setMoveTo] = useState(50);
  // Sprint 6 — 3D depth target for walk/run beats
  const [moveZ, setMoveZ] = useState(0);
  const [beatSpeed, setBeatSpeed] = useState(1);
  const [beatEasing, setBeatEasing] = useState<EasingName>("easeInOut");
  // TTS voice speaking rate for this line (0.5..2) — Sprint 5
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  // null = auto (end of this actor's track); number = pinned absolute start
  const [beatStart, setBeatStart] = useState<number | null>(null);

  // projects
  const [saveOpen, setSaveOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [saving, setSaving] = useState(false);

  // ---------- stage lifecycle ----------
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const stage = new CartoonStage(canvas, {
      onBeatStart: (beat, offset) => {
        setActiveBeatIds((prev) => new Set(prev).add(beat.id));
        playBeatAudio(beat, offset);
      },
      onBeatEnd: (beat) => {
        setActiveBeatIds((prev) => {
          const next = new Set(prev);
          next.delete(beat.id);
          return next;
        });
        stopBeatAudio(beat.id);
      },
      onTime: (t) => {
        // throttle React updates to ~20fps for the playhead
        const now = performance.now();
        if (now - lastTimePushRef.current > 50) {
          lastTimePushRef.current = now;
          setCurrentTime(t);
        }
      },
      onFinish: () => {
        setPlaying(false);
        setActiveBeatIds(new Set());
        stopAllAudio();
        if (exportingRef.current) {
          recorderRef.current?.stop();
          recorderRef.current = null;
        }
      },
    });
    stageRef.current = stage;
    return () => {
      stage.dispose();
      stageRef.current = null;
    };
  }, []);

  useEffect(() => {
    stageRef.current?.setScene(scene, designs);
  }, [scene, designs]);

  // audio-aware durations + viseme lip-sync envelopes + timeline data stay in sync
  useEffect(() => {
    const durMap: Record<string, number> = {};
    const envMap: Record<string, number[]> = {};
    const wideMap: Record<string, number[]> = {};
    for (const b of scene.beats) {
      const a = getCachedAudio(b.id);
      if (a) {
        durMap[b.id] = Math.max(b.duration, a.duration + 0.3);
        const open = a.openEnv?.length ? a.openEnv : a.envelope;
        if (open?.length) {
          envMap[b.id] = open;
          if (a.wideEnv?.length) wideMap[b.id] = a.wideEnv;
        }
      }
    }
    const stage = stageRef.current;
    stage?.setDurations(durMap);
    stage?.setEnvelopes(envMap, wideMap);
  }, [scene.beats, audioVersion]);

  // global playback speed
  useEffect(() => {
    rateRef.current = playbackRate;
    stageRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  // keep a ref of the selected beat for pointer callbacks
  useEffect(() => {
    selectedBeatIdRef.current = selectedBeatId;
  }, [selectedBeatId]);

  // drag characters + walk-target flag directly on the stage
  useEffect(() => {
    stageRef.current?.setInteractions({
      onPick: (uid) => {
        setSelectedBeatId(null);
        stageRef.current?.setEditBeat(null);
      },
      onDrag: (uid, pct) => updatePlaced(uid, { x: Math.round(pct * 10) / 10 }),
      onDragEnd: (uid, pct) => updatePlaced(uid, { x: Math.round(pct * 10) / 10 }),
      onDragTarget: (pct) => {
        if (selectedBeatIdRef.current) {
          updateBeat(selectedBeatIdRef.current, {
            moveTo: Math.round(pct * 10) / 10,
          });
        }
      },
      onDragTargetEnd: (pct) => {
        if (selectedBeatIdRef.current) {
          updateBeat(selectedBeatIdRef.current, {
            moveTo: Math.round(pct * 10) / 10,
          });
        }
      },
    });
  }, [updatePlaced, updateBeat]);

  // space = play/pause shortcut
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      )
        return;
      e.preventDefault();
      handlePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, scene.beats]);

  const stopBeatAudio = (beatId: string) => {
    const el = playingAudioRef.current.get(beatId);
    if (el) {
      el.pause();
      el.onended = null;
      playingAudioRef.current.delete(beatId);
    }
  };

  const stopAllAudio = () => {
    for (const el of playingAudioRef.current.values()) {
      el.pause();
      el.onended = null;
    }
    playingAudioRef.current.clear();
  };

  const playBeatAudio = (beat: SceneBeat, offset = 0) => {
    const audio = getCachedAudio(beat.id);
    if (!audio) return;
    // during scrubbing (paused) we stay silent — audio only when actually playing
    if (!stageRef.current?.isPlaying()) return;
    stopBeatAudio(beat.id);
    const el = new Audio(audio.url);
    el.playbackRate = rateRef.current;
    try {
      (el as HTMLAudioElement & { preservesPitch?: boolean }).preservesPitch = true;
    } catch {
      /* older browsers */
    }
    if (offset > 0.05) {
      try {
        el.currentTime = offset;
      } catch {
        /* ignore */
      }
    }
    playingAudioRef.current.set(beat.id, el);
    el.onended = () => {
      playingAudioRef.current.delete(beat.id);
    };
    if (exportingRef.current && audioCtxRef.current && destRef.current) {
      try {
        const src = audioCtxRef.current.createMediaElementSource(el);
        src.connect(destRef.current);
        src.connect(audioCtxRef.current.destination);
      } catch {
        /* ignore */
      }
    }
    el.play().catch(() => {});
  };

  // ---------- playback ----------
  const handlePlay = () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (playing) {
      stage.pause();
      stopAllAudio();
      setPlaying(false);
      return;
    }
    const ok = stage.play();
    if (!ok) {
      toast({
        title: "কোনো দৃশ্য নেই",
        description: "আগে টাইমলাইনের নিচে ফর্ম থেকে অন্তত একটি দৃশ্য (বিট) যোগ করুন।",
        variant: "destructive",
      });
      return;
    }
    setPlaying(true);
  };

  const handleStop = () => {
    stageRef.current?.stop();
    stopAllAudio();
    setPlaying(false);
    setActiveBeatIds(new Set());
    setCurrentTime(0);
    if (exportingRef.current) {
      recorderRef.current?.stop();
      recorderRef.current = null;
    }
  };

  // ---------- timeline ----------
  const effectiveDur = (b: SceneBeat) => {
    const a = getCachedAudio(b.id);
    return Math.max(0.3, a ? Math.max(b.duration, a.duration + 0.3) : b.duration);
  };

  const totalDuration = useMemo(() => {
    // multi-track: total = the furthest beat END (not the sum)
    let total = 0;
    for (const b of scene.beats) {
      const st = typeof b.start === "number" && b.start >= 0 ? b.start : 0;
      total = Math.max(total, st + effectiveDur(b));
    }
    return total;
  }, [scene.beats, audioVersion]);

  const timelineActors: TimelineActor[] = useMemo(
    () =>
      scene.characters.map((c) => ({
        uid: c.uid,
        name: designs.find((d) => d.id === c.designId)?.name ?? "অজানা",
        color: actorColorOf(c.uid, scene.characters),
      })),
    [scene.characters, designs],
  );

  const timelineBeats: TimelineBeat[] = useMemo(
    () =>
      scene.beats.map((b) => {
        const a = getCachedAudio(b.id);
        const opt = ACTION_OPTIONS.find((o) => o.id === b.action);
        return {
          id: b.id,
          actorUid: b.actorUid,
          start: typeof b.start === "number" && b.start >= 0 ? b.start : 0,
          actorName:
            designs.find(
              (d) => d.id === scene.characters.find((c) => c.uid === b.actorUid)?.designId,
            )?.name ?? "অজানা",
          actorColor: actorColorOf(b.actorUid, scene.characters),
          action: b.action,
          actionEmoji: opt?.emoji ?? "🎬",
          actionLabel: opt?.label ?? b.action,
          text: b.text,
          duration: effectiveDur(b),
          hasAudio: !!a,
          peaks: a?.peaks ?? null,
        };
      }),
    [scene.beats, scene.characters, designs, audioVersion],
  );

  const handleSeek = (t: number) => {
    if (exportingRef.current) return;
    stopAllAudio();
    stageRef.current?.seek(t);
    setCurrentTime(t);
  };

  const handleTimelineSelect = (id: string) => {
    setSelectedBeatId(id);
    const b = scene.beats.find((x) => x.id === id);
    if (b) startEditBeat(b);
  };

  const handleTimelineResize = (id: string, newDuration: number) => {
    updateBeat(id, { duration: Math.round(newDuration * 10) / 10 });
  };

  const handleTimelineMove = (id: string, newStart: number, newActorUid?: string) => {
    moveBeatTo(id, newStart, newActorUid);
  };

  // ---------- voice generation ----------
  const genBeatVoice = async (beat: SceneBeat, silent = false) => {
    if (!beat.text.trim()) {
      if (!silent)
        toast({ title: "ডায়ালগ লিখুন আগে", description: "এই দৃশ্যে কোনো সংলাপ নেই।" });
      return;
    }
    const placed = scene.characters.find((c) => c.uid === beat.actorUid);
    const design = designs.find((d) => d.id === placed?.designId);
    setGenBusyId(beat.id);
    try {
      const audio = await generateVoice(
        beat.text,
        design?.voice ?? "tongtong",
        beat.voiceSpeed ?? 1,
      );
      setCachedAudio(beat.id, audio);
      setAudioVersion((v) => v + 1);
      if (!silent)
        toast({
          title: "ভয়েস রেডি 🔊",
          description: `${audio.duration.toFixed(1)} সেকেন্ডের অডিও তৈরি হয়েছে।`,
        });
    } catch (e: unknown) {
      if (!silent)
        toast({
          title: "ভয়েস তৈরি করা যায়নি",
          description: e instanceof Error ? e.message : "আবার চেষ্টা করুন।",
          variant: "destructive",
        });
    } finally {
      setGenBusyId(null);
    }
  };

  const genAllVoices = async () => {
    const pending = scene.beats.filter((b) => b.text.trim() && !getCachedAudio(b.id));
    if (pending.length === 0) {
      toast({ title: "সব ভয়েস আগেই রেডি ✅", description: "এখন প্লে করে দেখুন!" });
      return;
    }
    toast({
      title: `${bnNum(pending.length)}টি ভয়েস জেনারেট হচ্ছে...`,
      description: "প্রতিটি সংলাপের বাংলা ভয়েস তৈরি করা হচ্ছে।",
    });
    for (const b of pending) {
      await genBeatVoice(b, true);
    }
    toast({ title: "সব ভয়েস রেডি 🔊", description: "এখন ▶ প্লে চাপুন!" });
  };

  // ---------- export ----------
  const handleExport = () => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    if (playing) {
      toast({ title: "আগে প্লে বন্ধ করুন", variant: "destructive" });
      return;
    }
    if (scene.beats.length === 0) {
      toast({
        title: "কোনো দৃশ্য নেই",
        description: "আগে বিট যোগ করুন, তারপর এক্সপোর্ট করুন।",
        variant: "destructive",
      });
      return;
    }
    try {
      const { mime, ext } = pickMime();
      const stream = canvas.captureStream(30);
      let audioCtx: AudioContext | null = null;
      try {
        audioCtx = new AudioContext();
        const dest = audioCtx.createMediaStreamDestination();
        audioCtxRef.current = audioCtx;
        destRef.current = dest;
        for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      } catch {
        audioCtxRef.current = null;
        destRef.current = null;
      }
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, {
          type: mime ? mime.split(";")[0] : "video/webm",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `thatta-cartoon-${Date.now()}.${ext}`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        setExporting(false);
        exportingRef.current = false;
        audioCtx?.close().catch(() => {});
        audioCtxRef.current = null;
        destRef.current = null;
        toast({
          title: "ভিডিও ডাউনলোড হয়েছে 🎬",
          description: `${ext.toUpperCase()} ফরম্যাটে সেভ হয়েছে — এবার YouTube/Facebook এ আপলোড করুন!`,
        });
      };
      recorderRef.current = rec;
      rec.start(250);
      setExporting(true);
      exportingRef.current = true;
      // always export from the very beginning
      stage.stop();
      const ok = stage.play();
      if (!ok) {
        rec.stop();
        return;
      }
      setPlaying(true);
      toast({
        title: "এক্সপোর্ট চলছে 🎥",
        description: "কার্টুন শেষ হলে ভিডিও স্বয়ংক্রিয়ভাবে ডাউনলোড হবে।",
      });
    } catch (e: unknown) {
      setExporting(false);
      exportingRef.current = false;
      toast({
        title: "এক্সপোর্ট করা যায়নি",
        description: e instanceof Error ? e.message : "আপনার ব্রাউজার ভিডিও রেকর্ডিং সাপোর্ট করে না।",
        variant: "destructive",
      });
    }
  };

  // ---------- beat editor ----------
  const resetBeatForm = () => {
    setEditingBeatId(null);
    setSelectedBeatId(null);
    setActorUid("");
    setAction("talk");
    setDuration(3);
    setText("");
    setMoveTo(50);
    setMoveZ(0);
    setBeatSpeed(1);
    setBeatEasing("easeInOut");
    setVoiceSpeed(1);
    setBeatStart(null);
    stageRef.current?.setEditBeat(null);
  };

  const submitBeat = () => {
    if (!actorUid) {
      toast({
        title: "ক্যারেক্টার নির্বাচন করুন",
        description: "কোন ক্যারেক্টর এই দৃশ্যে থাকবে সেটা বাছুন।",
        variant: "destructive",
      });
      return;
    }
    const payload = {
      actorUid,
      action,
      duration,
      text: text.trim(),
      // pinned start only when editing or when the user chose one;
      // new beats otherwise auto-place at the end of the actor's track
      start:
        editingBeatId || beatStart != null
          ? Math.max(0, beatStart ?? 0)
          : undefined,
      moveTo: action === "walk" || action === "run" ? moveTo : undefined,
      // 3D depth path — 0 = stage plane (towards camera when negative)
      moveZ: action === "walk" || action === "run" ? moveZ : undefined,
      speed: beatSpeed !== 1 ? beatSpeed : undefined,
      easing: action === "walk" || action === "run" ? beatEasing : undefined,
      voiceSpeed: voiceSpeed !== 1 ? voiceSpeed : undefined,
    };
    if (editingBeatId) {
      updateBeat(editingBeatId, payload);
      toast({ title: "দৃশ্য আপডেট হয়েছে ✅" });
    } else {
      addBeat(payload);
      toast({
        title: "দৃশ্য যোগ হয়েছে 🎬",
        description: `মোট দৃশ্য: ${bnNum(scene.beats.length + 1)}টি`,
      });
    }
    resetBeatForm();
  };

  const startEditBeat = (b: SceneBeat) => {
    setEditingBeatId(b.id);
    setSelectedBeatId(b.id);
    setActorUid(b.actorUid);
    setAction(b.action);
    setDuration(b.duration);
    setText(b.text);
    setMoveTo(b.moveTo ?? 50);
    setMoveZ(b.moveZ ?? scene.characters.find((c) => c.uid === b.actorUid)?.z ?? 0);
    setBeatSpeed(b.speed ?? 1);
    setBeatEasing(b.easing ?? "easeInOut");
    setVoiceSpeed(b.voiceSpeed ?? 1);
    setBeatStart(b.start ?? 0);
    // walk/run beats show the draggable destination flag on the stage
    stageRef.current?.setEditBeat(
      b.action === "walk" || b.action === "run" ? b.id : null,
    );
    editorCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // ---------- projects ----------
  const handleSaveProject = async () => {
    if (!projectName.trim()) {
      toast({ title: "প্রজেক্টের নাম দিন", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName.trim(),
          data: JSON.stringify({ scene, designs }),
        }),
      });
      if (!res.ok) throw new Error("সেভ করা যায়নি");
      toast({ title: "সেভ হয়েছে 💾", description: `"${projectName}" সার্ভারে সেভ হয়েছে।` });
      setSaveOpen(false);
      setProjectName("");
    } catch {
      toast({ title: "সেভ করা যায়নি", description: "আবার চেষ্টা করুন।", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openLoad = async () => {
    setLoadOpen(true);
    setLoadingProjects(true);
    try {
      const res = await fetch("/api/projects");
      const j = await res.json();
      setProjects(j.projects ?? []);
    } catch {
      toast({ title: "লিস্ট আনা যায়নি", variant: "destructive" });
    } finally {
      setLoadingProjects(false);
    }
  };

  const loadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const j = await res.json();
      const parsed = JSON.parse(j.project.data) as {
        scene?: Scene;
        designs?: CharacterDesign[];
      };
      if (parsed.scene && parsed.designs) {
        setScene(parsed.scene);
        setDesigns(parsed.designs);
        setLoadOpen(false);
        toast({ title: "প্রজেক্ট লোড হয়েছে 📂", description: j.project.name });
      } else {
        toast({ title: "ফাইল ভাঙা আছে", variant: "destructive" });
      }
    } catch {
      toast({ title: "লোড করা যায়নি", variant: "destructive" });
    }
  };

  const deleteProject = async (id: string) => {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      setProjects((p) => p.filter((x) => x.id !== id));
      toast({ title: "ডিলিট হয়েছে" });
    } catch {
      toast({ title: "ডিলিট করা যায়নি", variant: "destructive" });
    }
  };

  // ---------- derived ----------
  const designNameOf = (uid: string) => {
    const placed = scene.characters.find((c) => c.uid === uid);
    const d = designs.find((x) => x.id === placed?.designId);
    return d?.name;
  };

  const unplacedDesigns = designs.filter(
    (d) => !scene.characters.some((c) => c.designId === d.id),
  );

  return (
    <div className="space-y-6">
      {/* ---------- Stage ---------- */}
      <Card className="border-amber-200">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="overflow-hidden rounded-xl border border-amber-300 shadow-inner">
            <canvas
              ref={canvasRef}
              className="block w-full bg-amber-100"
              style={{ aspectRatio: "16 / 9" }}
              aria-label="কার্টুন স্টেজ"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              onClick={handlePlay}
              disabled={exporting}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {playing ? (
                <>
                  <Pause className="mr-2 h-4 w-4" /> থামান
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" /> প্লে করুন
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleStop}
              disabled={!playing && currentTime === 0}
              className="border-amber-300"
            >
              <Square className="mr-2 h-4 w-4" /> রিসেট
            </Button>
            <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-2.5 py-1">
              <span className="text-xs font-semibold text-amber-800">গতি</span>
              <Select
                value={String(playbackRate)}
                onValueChange={(v) => setPlaybackRate(Number(v))}
              >
                <SelectTrigger className="h-8 w-[86px] border-amber-200 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPEED_OPTIONS.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      ×{bnNum(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleExport}
              disabled={playing || exporting}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "এক্সপোর্ট হচ্ছে..." : "ভিডিও এক্সপোর্ট"}
            </Button>
            <Button
              variant="outline"
              onClick={genAllVoices}
              disabled={playing || exporting}
              className="border-teal-300 text-teal-800 hover:bg-teal-50"
            >
              <Volume2 className="mr-2 h-4 w-4" /> সব ভয়েস জেনারেট
            </Button>
            <div className="ml-auto flex gap-2.5">
              <Button
                variant="outline"
                onClick={() => setSaveOpen(true)}
                className="border-amber-300"
              >
                <Save className="mr-2 h-4 w-4" /> সেভ
              </Button>
              <Button variant="outline" onClick={openLoad} className="border-amber-300">
                <FolderOpen className="mr-2 h-4 w-4" /> লোড
              </Button>
            </div>
          </div>

          {(playing || exporting) && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              {exporting
                ? "🎥 রেকর্ড হচ্ছে — কার্টুন শেষ না হওয়া পর্যন্ত ট্যাব বদলাবেন না।"
                : `▶ চলছে — ${bnNum(currentTime.toFixed(1))} সে. • এখন অভিনয়ে: ${bnNum(activeBeatIds.size)}টি দৃশ্য`}
            </p>
          )}
          {!playing && !exporting && scene.characters.length > 0 && (
            <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">
              ✋ টিপ: ক্যারেক্টার টেনে সরান • গভীরতা (3D) স্লাইডারে দূরে-কাছে বদলান • হাঁটার দৃশ্যে 🚩 পতাকা টেনে গন্তব্য ঠিক করুন!
            </p>
          )}
        </CardContent>
      </Card>

      {/* ---------- Timeline ---------- */}
      <TimelineEditor
        beats={timelineBeats}
        actors={timelineActors}
        totalDuration={totalDuration}
        currentTime={currentTime}
        selectedBeatId={selectedBeatId}
        playing={playing}
        onSeek={handleSeek}
        onSelectBeat={handleTimelineSelect}
        onResizeBeat={handleTimelineResize}
        onMoveBeat={handleTimelineMove}
      />

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ---------- Left: scene setup ---------- */}
        <div className="space-y-6">
          <Card className="border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-orange-800">🏞️ ব্যাকগ্রাউন্ড</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {BG_OPTIONS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setBackground(b.id)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                      scene.background === b.id
                        ? "border-orange-600 bg-orange-600 text-white"
                        : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-orange-800">
                👥 ক্যারেক্টার ({bnNum(scene.characters.length)})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {scene.characters.length === 0 && (
                <div className="rounded-lg border border-dashed border-amber-300 p-4 text-center text-sm text-amber-700">
                  স্টেজে কোনো ক্যারেক্টার নেই।
                  {onOpenCreator ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={onOpenCreator}
                      className="mt-2 border-orange-300 text-orange-700"
                    >
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" /> ক্যারেক্টার তৈরি করুন
                    </Button>
                  ) : null}
                </div>
              )}
              <div className="thatta-scroll max-h-72 space-y-3 overflow-y-auto pr-1">
                {scene.characters.map((c) => {
                  const d = designs.find((x) => x.id === c.designId);
                  return (
                    <div
                      key={c.uid}
                      className="rounded-xl border border-amber-200 bg-white p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-bold text-amber-950">
                          {d?.name ?? "❓ অজানা"}
                        </p>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => updatePlaced(c.uid, { flip: !c.flip })}
                            aria-label="মুখ ঘোরান"
                          >
                            ⇄
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 border-rose-200 px-2 text-rose-700 hover:bg-rose-50"
                            onClick={() => removePlaced(c.uid)}
                            aria-label="সরান"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2.5">
                        <div>
                          <div className="mb-1 flex justify-between text-xs text-amber-800">
                            <span>অবস্থান (X)</span>
                            <span>{bnNum(Math.round(c.x))}%</span>
                          </div>
                          <Slider
                            value={[c.x]}
                            min={5}
                            max={95}
                            step={1}
                            onValueChange={(v) => updatePlaced(c.uid, { x: v[0] })}
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-xs text-amber-800">
                            <span>সাইজ</span>
                            <span>×{c.scale.toFixed(1)}</span>
                          </div>
                          <Slider
                            value={[c.scale]}
                            min={0.8}
                            max={1.8}
                            step={0.05}
                            onValueChange={(v) => updatePlaced(c.uid, { scale: v[0] })}
                          />
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-xs text-amber-800">
                            <span>গভীরতা (3D)</span>
                            <span>{bnNum(Math.round(c.z ?? 0))}</span>
                          </div>
                          <Slider
                            value={[c.z ?? 0]}
                            min={-120}
                            max={480}
                            step={10}
                            onValueChange={(v) => updatePlaced(c.uid, { z: v[0] })}
                          />
                          <p className="mt-1 text-[11px] leading-snug text-amber-600">
                            বাড়ালে ক্যারেক্টার দূরে ছোট হবে, কমালে ক্যামেরার কাছে বড় — সত্যিকারের 3D অনুভূতি!
                          </p>
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-xs text-amber-800">
                            <span>হাতের জিনিস</span>
                            <span>
                              {
                                PROP_OPTIONS.find((o) => o.id === (c.prop ?? "none"))
                                  ?.emoji
                              }
                            </span>
                          </div>
                          <Select
                            value={c.prop ?? "none"}
                            onValueChange={(v) =>
                              updatePlaced(c.uid, { prop: v as PropName })
                            }
                          >
                            <SelectTrigger className="h-8 w-full border-amber-200 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {PROP_OPTIONS.map((o) => (
                                <SelectItem key={o.id} value={o.id}>
                                  {o.emoji} {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {unplacedDesigns.length > 0 && (
                <div className="flex gap-2 border-t border-amber-100 pt-3">
                  <Select
                    value={undefined}
                    onValueChange={(v) => addPlaced(v)}
                  >
                    <SelectTrigger className="border-amber-300">
                      <SelectValue placeholder="ক্যারেক্টার বাছুন..." />
                    </SelectTrigger>
                    <SelectContent>
                      {unplacedDesigns.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="self-center text-xs text-amber-700">যোগ করুন</span>
                </div>
              )}
              {designs.length === 0 && (
                <p className="text-xs text-amber-700">
                  আগে ক্যারেক্টার তৈরি করুন —{' '}
                  {onOpenCreator && (
                    <button
                      onClick={onOpenCreator}
                      className="font-bold text-orange-700 underline"
                    >
                      ক্যারেক্টার তৈরি ট্যাব
                    </button>
                  )}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Sprint 6 — cinematic camera */}
          <Card className="border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-orange-800">🎥 সিনেমাটিক ক্যামেরা</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-amber-900">ইমপ্যাক্ট শেক</p>
                  <p className="text-xs text-amber-700">
                    থাপ্পড়/লাফ/পড়ে যাওয়ায় ক্যামেরা কেঁপে উঠবে — কমেডি ইমপ্যাক্ট!
                  </p>
                </div>
                <Switch
                  checked={scene.camera?.shake !== false}
                  onCheckedChange={setCameraShake}
                  aria-label="ইমপ্যাক্ট শেক চালু/বন্ধ"
                />
              </div>

              {(scene.camera?.shots ?? []).length === 0 ? (
                <p className="rounded-lg border border-dashed border-amber-300 p-3 text-xs text-amber-700">
                  শট যোগ করলে নির্দিষ্ট সময়ে ক্যামেরা ক্যারেক্টারের উপর মসৃণভাবে জুম করবে —
                  সিনেমার মতো ফোকাস, প্রিমিয়াম ফিনিশিং!
                </p>
              ) : (
                <div className="thatta-scroll max-h-80 space-y-3 overflow-y-auto pr-1">
                  {(scene.camera?.shots ?? []).map((shot) => (
                    <div
                      key={shot.id}
                      className="space-y-2.5 rounded-xl border border-amber-200 bg-white p-3"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-amber-950">
                          🎯 {bnNum(shot.start)}–{bnNum(shot.end)} সে.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 border-rose-200 px-2 text-rose-700 hover:bg-rose-50"
                          onClick={() => removeCameraShot(shot.id)}
                          aria-label="শট মুছুন"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs text-amber-800">শুরু (সে.)</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.5}
                            value={shot.start}
                            onChange={(e) =>
                              updateCameraShot(shot.id, {
                                start: Math.max(0, Number(e.target.value) || 0),
                              })
                            }
                            className="h-8 border-amber-200 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-amber-800">শেষ (সে.)</Label>
                          <Input
                            type="number"
                            min={0.5}
                            step={0.5}
                            value={shot.end}
                            onChange={(e) =>
                              updateCameraShot(shot.id, {
                                end: Math.max(0.5, Number(e.target.value) || 0.5),
                              })
                            }
                            className="h-8 border-amber-200 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs text-amber-800">
                          <span>জুম</span>
                          <span>×{bnNum(shot.zoom.toFixed(1))}</span>
                        </div>
                        <Slider
                          value={[shot.zoom]}
                          min={1}
                          max={2.4}
                          step={0.1}
                          onValueChange={(v) => updateCameraShot(shot.id, { zoom: v[0] })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-amber-800">কার উপর ফোকাস</Label>
                        <Select
                          value={shot.focusUid ?? "__pan"}
                          onValueChange={(v) =>
                            updateCameraShot(shot.id, {
                              focusUid: v === "__pan" ? null : v,
                              panX: v === "__pan" ? (shot.panX ?? 50) : undefined,
                            })
                          }
                        >
                          <SelectTrigger className="h-8 border-amber-200 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__pan">নির্দিষ্ট জায়গায় প্যান</SelectItem>
                            {scene.characters.map((c) => (
                              <SelectItem key={c.uid} value={c.uid}>
                                {designNameOf(c.uid) ?? "অজানা"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {shot.focusUid == null && (
                        <div>
                          <div className="flex justify-between text-xs text-amber-800">
                            <span>প্যান অবস্থান</span>
                            <span>{bnNum(Math.round(shot.panX ?? 50))}%</span>
                          </div>
                          <Slider
                            value={[shot.panX ?? 50]}
                            min={10}
                            max={90}
                            step={5}
                            onValueChange={(v) =>
                              updateCameraShot(shot.id, { panX: v[0] })
                            }
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <Button
                variant="outline"
                className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                onClick={() =>
                  addCameraShot({
                    start: 0,
                    end: 3,
                    zoom: 1.4,
                    focusUid: scene.characters[0]?.uid ?? null,
                    easing: "easeInOut",
                  })
                }
                disabled={scene.characters.length === 0}
              >
                <Video className="mr-2 h-4 w-4" /> ক্যামেরা শট যোগ করুন
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ---------- Right: beats ---------- */}
        <div className="space-y-6">
          <Card className="border-amber-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-orange-800">
                🎬 দৃশ্য তালিকা ({bnNum(scene.beats.length)}টি বিট)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="thatta-scroll max-h-80 space-y-2.5 overflow-y-auto pr-1">
                {scene.beats.map((b, i) => {
                  const aOpt = ACTION_OPTIONS.find((a) => a.id === b.action);
                  const hasVoice = !!getCachedAudio(b.id);
                  return (
                    <div
                      key={b.id}
                      className={`rounded-xl border p-3 ${
                        activeBeatIds.has(b.id)
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-amber-200 bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-amber-950">
                          <span className="mr-1.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-600 text-xs text-white">
                            {bnNum(i + 1)}
                          </span>
                          {aOpt?.emoji} {designNameOf(b.actorUid) ?? "❓"} — {aOpt?.label}
                          <span className="ml-1 text-xs text-amber-600">
                            ({bnNum(b.duration)} সে.)
                          </span>
                        </p>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 px-0"
                            onClick={() => moveBeat(b.id, -1)}
                            disabled={i === 0}
                            aria-label="উপরে"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 px-0"
                            onClick={() => moveBeat(b.id, 1)}
                            disabled={i === scene.beats.length - 1}
                            aria-label="নিচে"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 px-0"
                            onClick={() => startEditBeat(b)}
                            aria-label="সম্পাদনা"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 border-rose-200 px-0 text-rose-700 hover:bg-rose-50"
                            onClick={() => removeBeat(b.id)}
                            aria-label="মুছুন"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      {b.text && (
                        <p className="mt-1.5 truncate text-xs text-amber-800">
                          💬 {b.text}
                        </p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className={`h-7 text-xs ${
                            hasVoice
                              ? "border-emerald-300 text-emerald-700"
                              : "border-teal-300 text-teal-800"
                          }`}
                          onClick={() => genBeatVoice(b)}
                          disabled={genBusyId === b.id || !b.text.trim()}
                        >
                          <Mic className="mr-1 h-3 w-3" />
                          {genBusyId === b.id
                            ? "জেনারেট হচ্ছে..."
                            : hasVoice
                              ? "ভয়েস আছে 🔊"
                              : "ভয়েস বানান"}
                        </Button>
                        {b.moveTo != null && (
                          <span className="text-xs text-amber-600">
                            🚶 হাঁটবে {bnNum(Math.round(b.moveTo))}% পর্যন্ত
                          </span>
                        )}
                        {(b.moveZ ?? 0) !== 0 && (
                          <span className="text-xs text-amber-600">
                            🎥 গভীরে {bnNum(Math.round(b.moveZ ?? 0))} পর্যন্ত
                          </span>
                        )}
                        {b.voiceSpeed != null && b.voiceSpeed !== 1 && (
                          <span className="rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-800">
                            🗣 ×{bnNum(b.voiceSpeed)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {scene.beats.length === 0 && (
                  <p className="rounded-lg border border-dashed border-amber-300 p-6 text-center text-sm text-amber-700">
                    এখনো কোনো দৃশ্য নেই। নিচের ফর্ম থেকে প্রথম দৃশ্য যোগ করুন — ক্যারেক্টর
                    বাছুন, অ্যাকশন দিন, সংলাপ লিখুন! 👇
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200" ref={editorCardRef as never}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between text-orange-800">
                {editingBeatId ? "✏️ দৃশ্য সম্পাদনা" : "➕ নতুন দৃশ্য (বিট) যোগ করুন"}
                {editingBeatId && (
                  <Button size="sm" variant="ghost" onClick={resetBeatForm}>
                    <X className="mr-1 h-3.5 w-3.5" /> বাতিল
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-amber-900">ক্যারেক্টার</Label>
                  <Select value={actorUid} onValueChange={setActorUid}>
                    <SelectTrigger className="border-amber-300">
                      <SelectValue placeholder="কে অভিনয় করবে?" />
                    </SelectTrigger>
                    <SelectContent>
                      {scene.characters.map((c) => (
                        <SelectItem key={c.uid} value={c.uid}>
                          {designNameOf(c.uid) ?? "অজানা"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-amber-900">অ্যাকশন</Label>
                  <Select value={action} onValueChange={(v) => setAction(v as ActionName)}>
                    <SelectTrigger className="border-amber-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_OPTIONS.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.emoji} {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-end gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-sm font-semibold text-amber-900">
                    শুরুর সময় (সেকেন্ড)
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    value={beatStart ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setBeatStart(v === "" ? null : Math.max(0, Number(v)));
                    }}
                    placeholder="স্বয়ংক্রিয় — ক্যারেক্টরের শেষ দৃশ্যের পরে"
                    className="h-9 border-amber-300"
                  />
                  <p className="text-xs text-amber-600">
                    টাইমলাইনে ব্লক টেনেও সময় বদলানো যায়। একই সময় দিলে একাধিক ক্যারেক্টর একসাথে অভিনয় করবে!
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0 border-amber-300 text-xs"
                  onClick={() => setBeatStart(Math.round(currentTime * 10) / 10)}
                >
                  প্লেহেডে বসান
                </Button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm font-semibold text-amber-900">সময়</Label>
                  <span className="text-sm text-amber-700">{bnNum(duration)} সেকেন্ড</span>
                </div>
                <Slider
                  value={[duration]}
                  min={1}
                  max={15}
                  step={0.5}
                  onValueChange={(v) => setDuration(v[0])}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-amber-900">
                  সংলাপ (ডায়ালগ) — বাংলায় লিখুন
                </Label>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="যেমন: কী রে গোপাল, আবার কী জগাখিচুড়ি শুরু করেছিস?"
                  rows={2}
                  className="border-amber-300 focus-visible:ring-orange-400"
                />
                <p className="text-xs text-amber-600">
                  সংলাপ সাবটাইটেল হিসেবে দেখাবে আর 🎙 বাটনে চাপলে বাংলা ভয়েস তৈরি হবে।
                </p>
              </div>

              {/* Sprint 5 — per-line voice speaking rate */}
              <div className="flex items-center gap-2.5 rounded-xl border border-teal-200 bg-teal-50/60 p-3">
                <Volume2 className="h-4 w-4 shrink-0 text-teal-700" />
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-semibold text-teal-900">
                    ভয়েসের কথার গতি
                  </Label>
                  <p className="text-xs text-teal-700">
                    ধীরে = নাটকীয় ভাব, দ্রুত = ঝকঝকে কমেডি। বদলালে আবার 🎙 ভয়েস বানান।
                  </p>
                </div>
                <Select
                  value={String(voiceSpeed)}
                  onValueChange={(v) => setVoiceSpeed(Number(v))}
                >
                  <SelectTrigger className="h-9 w-[92px] shrink-0 border-teal-300 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_SPEED_OPTIONS.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        ×{bnNum(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {action === "walk" || action === "run" ? (
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm font-semibold text-amber-900">
                      কোথা পর্যন্ত যাবে (X)
                    </Label>
                    <span className="text-sm text-amber-700">{bnNum(moveTo)}%</span>
                  </div>
                  <Slider
                    value={[moveTo]}
                    min={5}
                    max={95}
                    step={1}
                    onValueChange={(v) => setMoveTo(v[0])}
                  />
                  <div className="space-y-2 pt-1">
                    <Label className="text-sm font-semibold text-amber-900">
                      গতিপথের ভাব (easing)
                    </Label>
                    <Select
                      value={beatEasing}
                      onValueChange={(v) => setBeatEasing(v as EasingName)}
                    >
                      <SelectTrigger className="border-amber-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {EASING_OPTIONS.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            {e.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2 rounded-xl border border-teal-200 bg-teal-50/50 p-3">
                    <div className="flex justify-between">
                      <Label className="text-sm font-semibold text-teal-900">
                        গভীরে যাবে (3D ডেপথ)
                      </Label>
                      <span className="text-sm font-semibold text-teal-800">
                        {bnNum(Math.round(moveZ))}
                      </span>
                    </div>
                    <Slider
                      value={[moveZ]}
                      min={-120}
                      max={480}
                      step={10}
                      onValueChange={(v) => setMoveZ(v[0])}
                    />
                    <p className="text-xs text-teal-700">
                      বাড়ালে ক্যারেক্টার হাঁটতে হাঁটতে দূরে ছোট হয়ে যাবে, কমালে ক্যামেরার দিকে বড় হয়ে আসবে — সিনেমার 3D মুভমেন্ট!
                    </p>
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <div className="flex justify-between">
                  <Label className="text-sm font-semibold text-amber-900">
                    অ্যানিমেশন স্পিড (এই দৃশ্যের)
                  </Label>
                  <span className="text-sm font-semibold text-orange-700">
                    ×{bnNum(beatSpeed.toFixed(2).replace(/\.?0+$/, ""))}
                  </span>
                </div>
                <Slider
                  value={[beatSpeed]}
                  min={0.5}
                  max={2}
                  step={0.05}
                  onValueChange={(v) => setBeatSpeed(v[0])}
                />
                <p className="text-xs text-amber-600">
                  কম = ধীর ও নাটকীয়, বেশি = দ্রুত ও কৌতুকপূর্ণ। ভয়েসের গতি বদলাবে না।
                </p>
              </div>

              <Button
                onClick={submitBeat}
                className="w-full bg-orange-600 text-white hover:bg-orange-700 sm:w-auto"
              >
                {editingBeatId ? "আপডেট করুন" : "দৃশ্য যোগ করুন"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ---------- Save dialog ---------- */}
      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-800">প্রজেক্ট সেভ করুন</DialogTitle>
            <DialogDescription>
              সিন, ক্যারেক্টার ও দৃশ্যগুলো সার্ভারে সেভ হবে — যেকোনো সময় লোড করা যাবে।
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="প্রজেক্টের নাম: যেমন — গোপাল ও পুলিশ"
              className="border-amber-300"
            />
            <Button
              onClick={handleSaveProject}
              disabled={saving}
              className="w-full bg-orange-600 text-white hover:bg-orange-700"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "সেভ হচ্ছে..." : "সেভ করুন"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Load dialog ---------- */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-800">প্রজেক্ট লোড করুন</DialogTitle>
            <DialogDescription>সেভ করা প্রজেক্ট লিস্ট থেকে বাছুন।</DialogDescription>
          </DialogHeader>
          <div className="thatta-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
            {loadingProjects && (
              <p className="py-6 text-center text-sm text-amber-700">লোড হচ্ছে...</p>
            )}
            {!loadingProjects && projects.length === 0 && (
              <p className="py-6 text-center text-sm text-amber-700">
                কোনো সেভ করা প্রজেক্ট নেই।
              </p>
            )}
            {projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 p-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-amber-950">{p.name}</p>
                  <p className="text-xs text-amber-600">
                    {new Date(p.updatedAt).toLocaleDateString("bn-BD")}
                  </p>
                </div>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
                    onClick={() => loadProject(p.id)}
                  >
                    লোড
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 border-rose-200 text-rose-700 hover:bg-rose-50"
                    onClick={() => deleteProject(p.id)}
                    aria-label="ডিলিট"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
