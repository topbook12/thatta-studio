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
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useStudio } from "@/lib/store";
import {
  episodeAudioBuses,
  episodeTiming,
  locateInEpisode,
} from "@/lib/cartoon/episode";
import SceneStrip from "@/components/studio/scene-strip";
import {
  exportVideoWebCodecs,
  ExportCancelled,
  webCodecsAvailable,
  type ExportBeatAudio,
} from "@/lib/cartoon/exporter";
import {
  deleteLocalProject,
  getLocalProject,
  listLocalProjects,
  saveLocalProject,
  type LocalProjectMeta,
} from "@/lib/local-projects";
import {
  cancelScheduledAutosave,
  flushAutosave,
  markSessionClean,
  markSessionOpen,
  readLatestAutosave,
  scheduleAutosave,
  wasUncleanExit,
} from "@/lib/autosave";
import { applyTemplate, TEMPLATES } from "@/lib/cartoon/templates";
import GuidedTour, {
  markTourDone,
  tourAlreadyDone,
  type TourStep,
} from "@/components/studio/guided-tour";
import {
  ACTION_OPTIONS,
  BG_OPTIONS,
  EASING_OPTIONS,
  PROP_OPTIONS,
  SPEED_OPTIONS,
  VOICE_SPEED_OPTIONS,
} from "@/lib/cartoon/presets";
import { CartoonStage } from "@/lib/cartoon/engine";
import {
  getCachedAudio,
  generateVoice,
  restoreVoiceAudio,
  setCachedAudio,
} from "@/lib/tts-cache";
import { normalizeEpisodes } from "@/lib/cartoon/presets";
import type {
  ActionName,
  CharacterDesign,
  EasingName,
  EpisodeScene,
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
  BadgeCheck,
  Cloud,
  Compass,
  Download,
  Film,
  FolderOpen,
  HardDrive,
  Keyboard,
  LayoutTemplate,
  Mic,
  Pause,
  Pencil,
  Play,
  Redo2,
  Save,
  Square,
  Trash2,
  Undo2,
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

/** কীবোর্ড শর্টকাট চিট-শিট */
const SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "Space", label: "প্লে / থামান" },
  { keys: "Ctrl + Z", label: "আনডু — আগের ধাপে ফিরুন" },
  { keys: "Ctrl + Shift + Z", label: "রিডু — আবার এগিয়ে যান" },
  { keys: "Ctrl + Y", label: "রিডু (বিকল্প)" },
];

// Phase 1 (Day 1–10) — guided tour script: stage → timeline → voice → export
const TOUR_STEPS: TourStep[] = [
  {
    targetId: "tour-stage",
    title: "এটাই আপনার মঞ্চ!",
    body: "ক্যারেক্টার টেনে সরান, সাইজ ও গভীরতা (3D) বদলান — মঞ্চের সবকিছু আপনার হাতে।",
  },
  {
    targetId: "tour-timeline",
    title: "টাইমলাইনে গল্প সাজান",
    body: "প্রতিটি দৃশ্য (বিট) একটি রঙিন ব্লক — টেনে সময় বদলান, কিনারা টেনে দৈর্ঘ্য কমান-বাড়ান।",
  },
  {
    targetId: "tour-voice",
    title: "সংলাপ + বাংলা ভয়েস",
    body: "নিচের ফর্মে সংলাপ লিখে 'ভয়েস বানান' চাপুন — ক্যারেক্টার ঠোঁট মিলিয়ে কথা বলবে!",
  },
  {
    targetId: "tour-export",
    title: "ভিডিও এক্সপোর্ট",
    body: "রেডি হলে এক ক্লিকে MP4 — YouTube/Facebook এ সরাসরি আপলোড করুন। কাজ স্বয়ংক্রিয় ব্যাকআপ হয়, ভয় নেই!",
  },
];

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
    scenes,
    activeSceneId,
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
    setActiveScene,
    setActiveSceneId,
    loadEpisodes,
    addCameraShot,
    updateCameraShot,
    removeCameraShot,
    setCameraShake,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useStudio();

  /** the scene currently on the stage (Phase 2 — the active EpisodeScene's Scene) */
  const scene = useMemo(
    () => (scenes.find((es) => es.id === activeSceneId) ?? scenes[0]).scene,
    [scenes, activeSceneId],
  );

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
  const designsRef = useRef(designs);

  const [playing, setPlaying] = useState(false);
  const [activeBeatIds, setActiveBeatIds] = useState<Set<string>>(new Set());
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [audioVersion, setAudioVersion] = useState(0);
  const [genBusyId, setGenBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  // Phase 2 — মাল্টি-সিন এপিসোড: play/export the WHOLE episode vs one scene
  const [episodePlay, setEpisodePlay] = useState(true);
  const [exportScope, setExportScope] = useState<"episode" | "scene">("episode");
  const episodeRef = useRef(false);

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
  const [cloudError, setCloudError] = useState(false);
  const [loadTab, setLoadTab] = useState("device");
  const [localProjects, setLocalProjects] = useState<LocalProjectMeta[]>([]);

  // Phase 1 (Day 1–10) — templates / auto-save / crash recovery / guided tour
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [recoverAt, setRecoverAt] = useState<number | null>(null);
  const [lastSaved, setLastSaved] = useState<number | null>(null);

  // Sprint 7 — premium export
  const [exportOpen, setExportOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exportQuality, setExportQuality] = useState<"720" | "1080">("720");
  const [exportFps, setExportFps] = useState(30);
  const [exportTags, setExportTags] = useState(true);
  const [exportFade, setExportFade] = useState(true);
  const [exportTitle, setExportTitle] = useState("");
  const [exportProgress, setExportProgress] = useState<{
    done: number;
    total: number;
    phase: string;
  } | null>(null);
  const cancelExportRef = useRef(false);
  const fastExport = webCodecsAvailable();

  // ---------- stage lifecycle ----------
  // advanceEpisodeRef: the onFinish callback below is created ONCE, so the
  // latest episode-advance logic is reached through a ref (updated per render).
  const advanceEpisodeRef = useRef<() => boolean>(() => false);
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
        stopAllAudio();
        const advanced = advanceEpisodeRef.current();
        if (!advanced) {
          setPlaying(false);
          setActiveBeatIds(new Set());
          if (exportingRef.current) {
            recorderRef.current?.stop();
            recorderRef.current = null;
          }
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

  // ---------- Phase 1: auto-save + crash recovery (Day 1–10) ----------
  useEffect(() => {
    designsRef.current = designs;
  }, [designs]);

  // debounced backup (3 s) on every store change — never blocks editing
  useEffect(() => {
    const unsub = useStudio.subscribe((s) => {
      if (!s.designs || !s.scenes?.length) return;
      scheduleAutosave(s.designs, s.scenes, (at) => setLastSaved(at));
    });
    return () => {
      unsub();
      cancelScheduledAutosave();
    };
  }, []);

  // clean-exit bookkeeping — absence of the flag = previous session died
  useEffect(() => {
    markSessionOpen();
    const onHide = () => {
      const s = useStudio.getState();
      flushAutosave(s.designs, s.scenes);
      markSessionClean();
    };
    window.addEventListener("pagehide", onHide);
    window.addEventListener("beforeunload", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("beforeunload", onHide);
    };
  }, []);

  // crash recovery: the previous session ended without cleanup.
  // Race-proof: register the hydration listener FIRST, then check
  // hasHydrated() (the event never fires for an already-finished
  // hydration), and keep a timer fallback in case hydration stalls.
  useEffect(() => {
    let ran = false;
    const check = () => {
      if (ran) return;
      ran = true;
      const unclean = wasUncleanExit();
      const backup = readLatestAutosave();
      if (!unclean || !backup) return;
      const current = useStudio.getState();
      const same =
        JSON.stringify(current.designs) === JSON.stringify(backup.designs) &&
        JSON.stringify(current.scenes) === JSON.stringify(backup.scenes);
      if (same) {
        toast({
          title: "শেষবার অ্যাপ হঠাৎ বন্ধ হয়েছিল",
          description: "চিন্তা নেই — আপনার কাজ অক্ষত আছে ✅",
        });
      } else {
        setRecoverAt(backup.savedAt);
      }
    };
    const off = useStudio.persist.onFinishHydration(check);
    if (useStudio.persist.hasHydrated()) {
      off();
      check();
      return;
    }
    const fallback = setTimeout(() => {
      off();
      check();
    }, 1500);
    return () => {
      off();
      clearTimeout(fallback);
    };
  }, []);

  // guided tour auto-opens once for first-time users
  useEffect(() => {
    if (tourAlreadyDone()) return;
    const t = setTimeout(() => setTourOpen(true), 900);
    return () => clearTimeout(t);
  }, []);

  // audio-aware durations + viseme lip-sync envelopes + timeline data stay in sync
  useEffect(() => {
    const { durMap, envMap, wideMap } = buildAudioMaps(scene);
    const stage = stageRef.current;
    stage?.setDurations(durMap);
    stage?.setEnvelopes(envMap, wideMap);
  }, [scene.beats, audioVersion]);

  // global playback speed
  useEffect(() => {
    rateRef.current = playbackRate;
    stageRef.current?.setPlaybackRate(playbackRate);
  }, [playbackRate]);

  // Sprint 7 — cold cache: rebuild voices from the offline IndexedDB store
  // (previously generated dialogue works again even with zero network)
  // Phase 2 — rebuild for EVERY scene of the episode (episode playback
  // and episode export need voices from scenes you are not editing)
  useEffect(() => {
    let alive = true;
    const run = async () => {
      let changed = false;
      for (const es of scenes) {
        for (const b of es.scene.beats) {
          if (!b.text.trim() || getCachedAudio(b.id)) continue;
          const design = designs.find(
            (d) =>
              d.id === es.scene.characters.find((c) => c.uid === b.actorUid)?.designId,
          );
          const restored = await restoreVoiceAudio(
            b.text.trim(),
            design?.voice ?? "tongtong",
            b.voiceSpeed ?? 1,
          );
          if (!alive) return;
          if (restored) {
            setCachedAudio(b.id, restored);
            changed = true;
          }
        }
      }
      if (changed && alive) setAudioVersion((v) => v + 1);
    };
    run();
    return () => {
      alive = false;
    };
  }, [scenes, designs]);

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

  // keyboard shortcuts: Space play/pause • Ctrl+Z undo • Ctrl+Shift+Z / Ctrl+Y redo
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const typing =
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable);
      if (e.code === "Space" && !typing) {
        e.preventDefault();
        handlePlay();
        return;
      }
      if (typing) return;
      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;
      const key = e.key.toLowerCase();
      if (key === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (key === "y") {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playing, scene.beats, undo, redo]);

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

  /** audio-aware durations + lip-sync envelopes for ONE scene (engine maps) */
  const buildAudioMaps = (sc: Scene) => {
    const durMap: Record<string, number> = {};
    const envMap: Record<string, number[]> = {};
    const wideMap: Record<string, number[]> = {};
    for (const b of sc.beats) {
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
    return { durMap, envMap, wideMap };
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
  /**
   * Phase 2 — when a scene finishes during EPISODE playback, roll straight
   * into the next scene (stage.stop → swap scene → play from 0). Returns
   * true when another scene started; false when the episode is over.
   */
  const advanceEpisode = (): boolean => {
    if (!episodeRef.current) return false;
    const st = useStudio.getState();
    const idx = st.scenes.findIndex((es) => es.id === st.activeSceneId);
    const next = idx >= 0 ? st.scenes[idx + 1] : undefined;
    if (!next) return false;
    const stage = stageRef.current;
    if (!stage) return false;
    stopAllAudio();
    setActiveBeatIds(new Set());
    stage.stop();
    // swap the stage synchronously (the [scene] effect re-syncs afterwards — idempotent)
    stage.setScene(next.scene, st.designs);
    setActiveSceneId(next.id);
    const ok = stage.play();
    if (!ok) {
      // empty scene → skip straight to the following one
      setActiveSceneId(next.id);
      const again = advanceEpisodeRef.current();
      if (!again) {
        setPlaying(false);
        if (exportingRef.current) {
          recorderRef.current?.stop();
          recorderRef.current = null;
        }
      }
      return again;
    }
    return true;
  };
  advanceEpisodeRef.current = advanceEpisode;

  const handlePlay = () => {
    const stage = stageRef.current;
    if (!stage) return;
    if (playing) {
      episodeRef.current = false;
      stage.pause();
      stopAllAudio();
      setPlaying(false);
      return;
    }
    const st = useStudio.getState();
    const multiScene = st.scenes.length > 1;
    episodeRef.current = episodePlay && multiScene;
    const hasAnyBeats = st.scenes.some((es) => es.scene.beats.length > 0);
    if (!hasAnyBeats) {
      toast({
        title: "কোনো দৃশ্য নেই",
        description: "আগে টাইমলাইনের নিচে ফর্ম থেকে অন্তত একটি দৃশ্য (বিট) যোগ করুন।",
        variant: "destructive",
      });
      return;
    }
    // playing an EPISODE always starts from scene 1; single-scene play
    // resumes from the playhead like before
    if (episodeRef.current) {
      const first = st.scenes[0];
      stage.stop();
      if (first.id !== st.activeSceneId) setActiveSceneId(first.id);
      stage.setScene(first.scene, st.designs);
    }
    const ok = stage.play();
    if (!ok) {
      // active scene empty but episode has content elsewhere → jump forward
      if (episodeRef.current && advanceEpisodeRef.current()) {
        setPlaying(true);
        return;
      }
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
    episodeRef.current = false;
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

  /** stop playback before a scene-structure change (strip / switch) */
  const stopForSceneChange = () => {
    if (!playing && !stageRef.current?.isPlaying()) return;
    episodeRef.current = false;
    stageRef.current?.stop();
    stopAllAudio();
    setPlaying(false);
    setActiveBeatIds(new Set());
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
    // Phase 2 — generate for EVERY scene of the episode (episode export
    // and episode playback need voices everywhere)
    const pending = scenes.flatMap((es) =>
      es.scene.beats.filter((b) => b.text.trim() && !getCachedAudio(b.id)),
    );
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

  // ---------- export (Sprint 7 — premium MP4) ----------
  const downloadBlob = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 8000);
  };

  const openExportDialog = () => {
    if (playing) {
      toast({ title: "আগে প্লে বন্ধ করুন", variant: "destructive" });
      return;
    }
    const anyBeats = scenes.some((es) => es.scene.beats.length > 0);
    if (!anyBeats) {
      toast({
        title: "কোনো দৃশ্য নেই",
        description: "আগে বিট যোগ করুন, তারপর এক্সপোর্ট করুন।",
        variant: "destructive",
      });
      return;
    }
    setExportScope(scenes.length > 1 ? "episode" : "scene");
    setExportOpen(true);
  };

  /** deterministic frame-by-frame MP4 (WebCodecs) — fast & flawless */
  const runFastExport = async () => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const st = useStudio.getState();
    const isEpisode = exportScope === "episode" && st.scenes.length > 1;
    const exportScenes: EpisodeScene[] = isEpisode
      ? st.scenes
      : [
          {
            id: st.activeSceneId,
            name: st.scenes.find((es) => es.id === st.activeSceneId)?.name ?? "দৃশ্য",
            scene,
          },
        ];
    if (exportScenes.every((es) => es.scene.beats.length === 0)) {
      toast({
        title: "কোনো দৃশ্য নেই",
        description: "আগে বিট যোগ করুন, তারপর এক্সপোর্ট করুন।",
        variant: "destructive",
      });
      return;
    }
    cancelExportRef.current = false;
    setExporting(true);
    setExportProgress({ done: 0, total: 1, phase: "শুরু হচ্ছে" });
    stage.stop();
    try {
      const audioOf = (id: string) => getCachedAudio(id);
      const timing = episodeTiming(exportScenes, audioOf);
      const buses: ExportBeatAudio[] = episodeAudioBuses(exportScenes, timing, audioOf);
      // per-scene engine maps: correct walk timing + lip-sync while rendering
      const maps = exportScenes.map((es) => buildAudioMaps(es.scene));
      const hi = exportQuality === "1080";
      let curIdx = -1;
      // Phase 2 — scene-boundary transitions (fade / circle wipe), 0.45 s
      const TRANS = 0.45;
      const smooth = (x: number) => x * x * (3 - 2 * x);
      const offA = document.createElement("canvas");
      const offB = document.createElement("canvas");
      const result = await exportVideoWebCodecs(
        canvas,
        (t) => {
          const { index, localT } = locateInEpisode(timing, t);
          if (index !== curIdx) {
            curIdx = index;
            const es = exportScenes[index];
            stage.prepareExportScene(es.scene, st.designs);
            stage.setDurations(maps[index].durMap);
            stage.setEnvelopes(maps[index].envMap, maps[index].wideMap);
          }
          const es = exportScenes[index];
          const dur = timing.scenes[index]?.duration ?? 0;
          const trans = es.transition ?? "cut";
          const hasNext = index < exportScenes.length - 1;
          const prevTrans =
            index > 0 ? (exportScenes[index - 1].transition ?? "cut") : "cut";
          const ctx = canvas.getContext("2d");
          if (!ctx) return;

          // ---- cartoon circle wipe OUT: reveal the next scene in a growing circle
          if (trans === "circle" && hasNext && localT > dur - TRANS) {
            stage.renderExportFrame(localT, { hideNameTags: !exportTags });
            const k = smooth(Math.max(0, Math.min(1, (localT - (dur - TRANS)) / TRANS)));
            offA.width = canvas.width;
            offA.height = canvas.height;
            offA.getContext("2d")?.drawImage(canvas, 0, 0);
            const nxt = exportScenes[index + 1];
            stage.prepareExportScene(nxt.scene, st.designs);
            stage.setDurations(maps[index + 1].durMap);
            stage.setEnvelopes(maps[index + 1].envMap, maps[index + 1].wideMap);
            stage.renderExportFrame(0, { hideNameTags: !exportTags });
            offB.width = canvas.width;
            offB.height = canvas.height;
            offB.getContext("2d")?.drawImage(canvas, 0, 0);
            ctx.drawImage(offA, 0, 0);
            ctx.save();
            ctx.beginPath();
            ctx.arc(
              canvas.width / 2,
              canvas.height / 2,
              k * Math.hypot(canvas.width, canvas.height) * 0.5,
              0,
              Math.PI * 2,
            );
            ctx.clip();
            ctx.drawImage(offB, 0, 0);
            ctx.restore();
            // hand the stage back to THIS scene — later frames keep rendering it
            stage.prepareExportScene(es.scene, st.designs);
            stage.setDurations(maps[index].durMap);
            stage.setEnvelopes(maps[index].envMap, maps[index].wideMap);
            return;
          }

          stage.renderExportFrame(localT, { hideNameTags: !exportTags });

          // ---- fade through black at the boundary (out on this scene, in on next)
          let black = 0;
          if (trans === "fade" && hasNext && localT > dur - TRANS) {
            black = Math.max(black, (localT - (dur - TRANS)) / TRANS);
          }
          if (prevTrans === "fade" && localT < TRANS) {
            black = Math.max(black, 1 - localT / TRANS);
          }
          if (black > 0.002) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, black);
            ctx.fillStyle = "#000";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.restore();
          }
        },
        timing.total,
        buses,
        {
          fps: exportFps,
          width: hi ? 1920 : 1280,
          height: hi ? 1080 : 720,
          bitrate: hi ? 9_000_000 : 5_000_000,
          hideNameTags: !exportTags,
          fadeInOut: exportFade,
          titleText: exportTitle,
          onProgress: (done, total, phase) =>
            setExportProgress({ done, total, phase }),
          cancelled: () => cancelExportRef.current,
        },
      );
      downloadBlob(result.blob, `thatta-cartoon-${Date.now()}.mp4`);
      toast({
        title: "MP4 ভিডিও তৈরি! 🎬",
        description: isEpisode
          ? `সম্পূর্ণ এপিসোড (${bnNum(exportScenes.length)}টি দৃশ্য) • ${hi ? "1080p" : "720p"} — এবার YouTube/Facebook এ আপলোড করুন!`
          : `${hi ? "1080p" : "720p"} • ${bnNum(exportFps)}fps — এবার YouTube/Facebook এ আপলোড করুন!`,
      });
      setExportOpen(false);
    } catch (e: unknown) {
      if (e instanceof ExportCancelled) {
        toast({ title: "এক্সপোর্ট বাতিল হয়েছে" });
        setExportOpen(false);
      } else {
        toast({
          title: "দ্রুত এক্সপোর্ট করা যায়নি",
          description:
            e instanceof Error
              ? e.message
              : "রিয়েল-টাইম রেকর্ডিং চেষ্টা করুন।",
          variant: "destructive",
        });
      }
    } finally {
      // hand the stage back to the user's active scene (export walked it
      // through every scene of the episode)
      stage.setScene(scene, designsRef.current);
      const active = buildAudioMaps(scene);
      stage.setDurations(active.durMap);
      stage.setEnvelopes(active.envMap, active.wideMap);
      setExporting(false);
      setExportProgress(null);
    }
  };

  /** fallback: realtime MediaRecorder capture (every browser) */
  const exportRealtime = () => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    if (playing) {
      toast({ title: "আগে প্লে বন্ধ করুন", variant: "destructive" });
      return;
    }
    const st = useStudio.getState();
    const isEpisode = exportScope === "episode" && st.scenes.length > 1;
    const relevant = isEpisode ? st.scenes : [st.scenes.find((es) => es.id === st.activeSceneId) ?? st.scenes[0]];
    if (relevant.every((es) => es.scene.beats.length === 0)) {
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
      const rec = new MediaRecorder(stream, {
        mimeType: mime || undefined,
        videoBitsPerSecond: 6_000_000,
      });
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        const blob = new Blob(chunks, {
          type: mime ? mime.split(";")[0] : "video/webm",
        });
        downloadBlob(blob, `thatta-cartoon-${Date.now()}.${ext}`);
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
      // episode export = play the whole episode (auto scene-advance is on);
      // single-scene export = play just this scene
      episodeRef.current = isEpisode;
      stage.stop();
      if (isEpisode) {
        const first = st.scenes[0];
        if (first.id !== st.activeSceneId) setActiveSceneId(first.id);
        stage.setScene(first.scene, st.designs);
      }
      const ok = stage.play();
      if (!ok) {
        rec.stop();
        return;
      }
      setPlaying(true);
      toast({
        title: "এক্সপোর্ট চলছে 🎥",
        description: isEpisode
          ? `সম্পূর্ণ এপিসোড রেকর্ড হচ্ছে (${bnNum(st.scenes.length)}টি দৃশ্য) — শেষ হলে স্বয়ংক্রিয়ভাবে ডাউনলোড হবে।`
          : "কার্টুন শেষ হলে ভিডিও স্বয়ংক্রিয়ভাবে ডাউনলোড হবে।",
      });
    } catch (e: unknown) {
      setExporting(false);
      exportingRef.current = false;
      toast({
        title: "এক্সপোর্ট করা যায়নি",
        description:
          e instanceof Error
            ? e.message
            : "আপনার ব্রাউজার ভিডিও রেকর্ডিং সাপোর্ট করে না।",
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
  const serializeProject = () =>
    JSON.stringify({ designs, scenes, activeSceneId });

  /**
   * Parse a saved project: new shape { designs, scenes, activeSceneId }
   * or legacy { designs, scene } (wrapped into a one-scene episode).
   */
  const parseProject = (
    raw: string,
  ): {
    scenes: EpisodeScene[];
    designs: CharacterDesign[];
    activeSceneId?: string;
  } | null => {
    const parsed = JSON.parse(raw) as {
      scene?: Scene;
      scenes?: unknown;
      designs?: CharacterDesign[];
      activeSceneId?: string;
    };
    if (!parsed.designs) return null;
    if (Array.isArray(parsed.scenes) && parsed.scenes.length > 0) {
      const normalized = normalizeEpisodes(parsed.scenes, () => scene);
      const activeSceneId = normalized.some((es) => es.id === parsed.activeSceneId)
        ? (parsed.activeSceneId as string)
        : normalized[0].id;
      return { scenes: normalized, designs: parsed.designs, activeSceneId };
    }
    if (parsed.scene) {
      return {
        scenes: normalizeEpisodes([{ id: "legacy", name: "দৃশ্য ১", scene: parsed.scene }], () => scene),
        designs: parsed.designs,
      };
    }
    return null;
  };

  const handleSaveLocal = () => {
    if (!projectName.trim()) {
      toast({ title: "প্রজেক্টের নাম দিন", variant: "destructive" });
      return;
    }
    const meta = saveLocalProject(projectName.trim(), serializeProject());
    setLocalProjects(listLocalProjects());
    toast({
      title: "ডিভাইসে সেভ হয়েছে 💾",
      description: `"${meta.name}" — সম্পূর্ণ এপিসোড (${bnNum(scenes.length)}টি দৃশ্য) সেভ হয়েছে, অফলাইনেও লোড করা যাবে।`,
    });
    setSaveOpen(false);
    setProjectName("");
  };

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
          data: serializeProject(),
        }),
      });
      if (!res.ok) throw new Error("সেভ করা যায়নি");
      toast({
        title: "সেভ হয়েছে 💾",
        description: `"${projectName}" ক্লাউডে সেভ হয়েছে — সব দৃশ্য সহ।`,
      });
      setSaveOpen(false);
      setProjectName("");
    } catch {
      toast({
        title: "ক্লাউডে সেভ হয়নি",
        description:
          "সার্ভার পাওয়া যায়নি — 'ডিভাইসে সেভ' ব্যবহার করুন, অফলাইনেও থাকবে।",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const openLoad = () => {
    setLoadOpen(true);
    setLocalProjects(listLocalProjects());
    setLoadingProjects(true);
    setCloudError(false);
    fetch("/api/projects")
      .then((r) => {
        if (!r.ok) throw new Error("cloud unavailable");
        return r.json();
      })
      .then((j) => setProjects(j.projects ?? []))
      .catch(() => {
        setProjects([]);
        setCloudError(true);
      })
      .finally(() => setLoadingProjects(false));
  };

  const loadLocalProject = (id: string) => {
    const p = getLocalProject(id);
    if (!p) return;
    try {
      const parsed = parseProject(p.data);
      if (parsed) {
        stopForSceneChange();
        loadEpisodes(parsed.scenes, parsed.designs, parsed.activeSceneId);
        setLoadOpen(false);
        toast({
          title: "প্রজেক্ট লোড হয়েছে 📂",
          description: `${p.name} — ${bnNum(parsed.scenes.length)}টি দৃশ্য`,
        });
      } else {
        toast({ title: "ফাইল ভাঙা আছে", variant: "destructive" });
      }
    } catch {
      toast({ title: "লোড করা যায়নি", variant: "destructive" });
    }
  };

  const deleteLocalProjectById = (id: string) => {
    deleteLocalProject(id);
    setLocalProjects(listLocalProjects());
    toast({ title: "ডিলিট হয়েছে" });
  };

  const loadProject = async (id: string) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      const j = await res.json();
      const parsed = parseProject(j.project.data);
      if (parsed) {
        stopForSceneChange();
        loadEpisodes(parsed.scenes, parsed.designs, parsed.activeSceneId);
        setLoadOpen(false);
        toast({
          title: "প্রজেক্ট লোড হয়েছে 📂",
          description: `${j.project.name} — ${bnNum(parsed.scenes.length)}টি দৃশ্য`,
        });
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

  // ---------- Phase 1: template loading + backup restore ----------
  const handleLoadTemplate = (id: string) => {
    const applied = applyTemplate(designs, id);
    if (!applied) return;
    // two sets in one tick → history coalesces into ONE undo step
    // Phase 2 — a template replaces the ACTIVE scene's content only;
    // the rest of the episode stays untouched
    setDesigns(applied.designs);
    setActiveScene(applied.scene);
    setTemplatesOpen(false);
    toast({
      title: "টেমপ্লেট লোড হয়েছে 🎬",
      description: "বর্তমান দৃশ্যে বসানো হয়েছে — প্লে করে দেখুন, Ctrl+Z দিয়ে ফিরে আসুন।",
    });
  };

  const handleRestoreBackup = () => {
    const backup = readLatestAutosave();
    if (!backup) {
      setRecoverAt(null);
      return;
    }
    stopForSceneChange();
    loadEpisodes(backup.scenes, backup.designs);
    setRecoverAt(null);
    setLastSaved(backup.savedAt);
    toast({
      title: "ব্যাকআপ রিস্টোর হয়েছে 💾",
      description: "আপনার শেষ কাজ ফিরে এসেছে — এখন আবার এডিট করতে পারেন।",
    });
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
          {/* Phase 2 — মাল্টি-সিন এপিসোড: scene manager strip */}
          <SceneStrip
            audioVersion={audioVersion}
            onStopPlayback={stopForSceneChange}
          />

          <div
            id="tour-stage"
            className="overflow-hidden rounded-xl border border-amber-300 shadow-inner"
          >
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
            {scenes.length > 1 && (
              <div className="flex items-center gap-2 rounded-xl border border-amber-300 bg-white px-2.5 py-1.5">
                <Switch
                  id="episode-play-toggle"
                  checked={episodePlay}
                  onCheckedChange={setEpisodePlay}
                  aria-label="সম্পূর্ণ এপিসোড প্লে করুন"
                />
                <label
                  htmlFor="episode-play-toggle"
                  className="cursor-pointer text-xs font-semibold text-amber-800"
                >
                  সম্পূর্ণ এপিসোড
                </label>
              </div>
            )}
            <Button
              variant="outline"
              onClick={handleStop}
              disabled={!playing && currentTime === 0}
              className="border-amber-300"
            >
              <Square className="mr-2 h-4 w-4" /> রিসেট
            </Button>
            <Button
              variant="outline"
              onClick={undo}
              disabled={!canUndo || exporting}
              title="আগের ধাপে (Ctrl+Z)"
              aria-label="আনডু"
              className="border-amber-300 px-2.5"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={redo}
              disabled={!canRedo || exporting}
              title="পরের ধাপে (Ctrl+Shift+Z)"
              aria-label="রিডু"
              className="border-amber-300 px-2.5"
            >
              <Redo2 className="h-4 w-4" />
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
              id="tour-export"
              onClick={openExportDialog}
              disabled={playing || exporting}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "এক্সপোর্ট হচ্ছে..." : "ভিডিও এক্সপোর্ট"}
            </Button>
            <Button
              id="tour-voice"
              variant="outline"
              onClick={genAllVoices}
              disabled={playing || exporting}
              className="border-teal-300 text-teal-800 hover:bg-teal-50"
            >
              <Volume2 className="mr-2 h-4 w-4" /> সব ভয়েস জেনারেট
            </Button>
            <div className="ml-auto flex items-center gap-2.5">
              <Button
                variant="outline"
                onClick={() => setTemplatesOpen(true)}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <LayoutTemplate className="mr-2 h-4 w-4" /> টেমপ্লেট
              </Button>
              {lastSaved != null && (
                <span
                  className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 md:flex"
                  title="আপনার কাজ প্রতি ৩ সেকেন্ডে ডিভাইসে ব্যাকআপ হচ্ছে"
                >
                  <BadgeCheck className="h-3.5 w-3.5" />
                  স্বয়ংক্রিয় সেভ{" "}
                  {new Date(lastSaved).toLocaleTimeString("bn-BD", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              <Button
                variant="outline"
                onClick={() => setTourOpen(true)}
                title="ব্যবহার গাইড (ট্যুর)"
                aria-label="ব্যবহার গাইড দেখুন"
                className="border-amber-300 px-2.5"
              >
                <Compass className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setShortcutsOpen(true)}
                title="কীবোর্ড শর্টকাট"
                aria-label="কীবোর্ড শর্টকাট দেখুন"
                className="border-amber-300 px-2.5"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
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
                ? "🎥 ভিডিও তৈরি হচ্ছে — শেষ না হওয়া পর্যন্ত অপেক্ষা করুন।"
                : `▶ চলছে${episodeRef.current ? ` — এপিসোড: দৃশ্য ${bnNum(Math.max(1, scenes.findIndex((es) => es.id === activeSceneId) + 1))}/${bnNum(scenes.length)}` : ""} — ${bnNum(currentTime.toFixed(1))} সে. • এখন অভিনয়ে: ${bnNum(activeBeatIds.size)}টি দৃশ্য`}
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
      {scene.beats.length === 0 && (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-5 text-center">
          <p className="text-base font-bold text-amber-900">
            🎬 টাইমলাইন খালি — এখানেই আপনার গল্প সাজবে!
          </p>
          <p className="mx-auto mt-1 max-w-xl text-sm text-amber-700">
            নিচের "নতুন দৃশ্য (বিট) যোগ করুন" ফর্মে ক্যারেক্টার + অ্যাকশন + সংলাপ দিন,
            অথবা এক ক্লিকে রেডিমেড টেমপ্লেট লোড করে সাথে সাথে শুরু করুন।
          </p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Button
              size="sm"
              onClick={() => setTemplatesOpen(true)}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              <LayoutTemplate className="mr-1.5 h-4 w-4" /> টেমপ্লেট দেখুন
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="border-amber-300"
              onClick={() =>
                editorCardRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "center",
                })
              }
            >
              নিজে দৃশ্য যোগ করুন ↓
            </Button>
          </div>
        </div>
      )}
      <div id="tour-timeline">
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
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        {/* ---------- Left: scene setup ---------- */}
        <div className="min-w-0 space-y-6">
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
                  স্টেজে কোনো ক্যারেক্টার নেই — প্যালেট থেকে যোগ করুন বা টেমপ্লেট দিয়ে শুরু করুন।
                  <div className="mt-2 flex flex-wrap justify-center gap-2">
                    {onOpenCreator && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={onOpenCreator}
                        className="border-orange-300 text-orange-700"
                      >
                        <UserPlus className="mr-1.5 h-3.5 w-3.5" /> ক্যারেক্টার তৈরি করুন
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTemplatesOpen(true)}
                      className="border-orange-300 text-orange-700"
                    >
                      <LayoutTemplate className="mr-1.5 h-3.5 w-3.5" /> টেমপ্লেট দেখুন
                    </Button>
                  </div>
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
        <div className="min-w-0 space-y-6">
          <Card className="min-w-0 border-amber-200">
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
              {scene.beats.length === 0 && !editingBeatId && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                  শুরু করা সহজ: ১) ক্যারেক্টার বাছুন → ২) অ্যাকশন বাছুন → ৩) সংলাপ লিখুন →{" "}
                  ৪) দৃশ্য যোগ করুন চাপুন। প্রতিটি দৃশ্য টাইমলাইনে রঙিন ব্লক হয়ে বসবে!
                </p>
              )}
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
              সিন, ক্যারেক্টার ও দৃশ্যগুলো সেভ হবে — ডিভাইসে সেভ অফলাইনেও কাজ করে।
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="প্রজেক্টের নাম: যেমন — গোপাল ও পুলিশ"
              className="border-amber-300"
            />
            <div className="grid grid-cols-2 gap-2.5">
              <Button
                onClick={handleSaveLocal}
                variant="outline"
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                <HardDrive className="mr-2 h-4 w-4" /> ডিভাইসে সেভ
              </Button>
              <Button
                onClick={handleSaveProject}
                disabled={saving}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                <Cloud className="mr-2 h-4 w-4" />
                {saving ? "সেভ হচ্ছে..." : "ক্লাউডে সেভ"}
              </Button>
            </div>
            <p className="text-center text-xs text-amber-600">
              ডিভাইসে সেভ = ইন্টারনেট ছাড়াই (PWA অফলাইন মোড) • ক্লাউডে সেভ = সার্ভারে নিরাপদ
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Load dialog ---------- */}
      <Dialog open={loadOpen} onOpenChange={setLoadOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-800">প্রজেক্ট লোড করুন</DialogTitle>
            <DialogDescription>
              ডিভাইসে সেভ করা বা ক্লাউডে সেভ করা প্রজেক্ট থেকে বাছুন।
            </DialogDescription>
          </DialogHeader>
          <Tabs value={loadTab} onValueChange={setLoadTab}>
            <TabsList className="grid h-auto w-full grid-cols-2">
              <TabsTrigger value="device" className="gap-1.5 py-2 text-sm">
                <HardDrive className="h-4 w-4" /> ডিভাইসে ({bnNum(localProjects.length)})
              </TabsTrigger>
              <TabsTrigger value="cloud" className="gap-1.5 py-2 text-sm">
                <Cloud className="h-4 w-4" /> ক্লাউড ({bnNum(projects.length)})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="device" className="mt-3">
              <div className="thatta-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
                {localProjects.length === 0 && (
                  <p className="py-6 text-center text-sm text-amber-700">
                    ডিভাইসে কোনো প্রজেক্ট নেই — সেভ ডায়ালগ থেকে &quot;ডিভাইসে সেভ&quot; করুন।
                  </p>
                )}
                {localProjects.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/40 p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-amber-950">{p.name}</p>
                      <p className="text-xs text-amber-600">
                        💾 অফলাইন • {new Date(p.updatedAt).toLocaleDateString("bn-BD")}
                      </p>
                    </div>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        className="h-8 bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={() => loadLocalProject(p.id)}
                      >
                        লোড
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 border-rose-200 text-rose-700 hover:bg-rose-50"
                        onClick={() => deleteLocalProjectById(p.id)}
                        aria-label="ডিলিট"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="cloud" className="mt-3">
              <div className="thatta-scroll max-h-72 space-y-2 overflow-y-auto pr-1">
                {loadingProjects && (
                  <p className="py-6 text-center text-sm text-amber-700">লোড হচ্ছে...</p>
                )}
                {cloudError && (
                  <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-center text-xs text-amber-800">
                    ☁️ ক্লাউড সার্ভার পাওয়া যায়নি — &quot;ডিভাইসে&quot; ট্যাব ব্যবহার করুন,
                    ইন্টারনেট ছাড়াই কাজ করে।
                  </p>
                )}
                {!loadingProjects && !cloudError && projects.length === 0 && (
                  <p className="py-6 text-center text-sm text-amber-700">
                    ক্লাউডে কোনো সেভ করা প্রজেক্ট নেই।
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
                        ☁️ {new Date(p.updatedAt).toLocaleDateString("bn-BD")}
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
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ---------- Export dialog (Sprint 7 — premium MP4) ---------- */}
      <Dialog
        open={exportOpen}
        onOpenChange={(o) => {
          if (!exportProgress) setExportOpen(o);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-800">ভিডিও এক্সপোর্ট — প্রিমিয়াম MP4</DialogTitle>
            <DialogDescription>
              প্রতিটি ফ্রেম নিখুঁতভাবে রেন্ডার হয় — ভিডিও ঝকঝকে, ভয়েস পারফেক্ট সিঙ্কে।
            </DialogDescription>
          </DialogHeader>
          {exportProgress ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm font-semibold text-amber-900">
                <span>⚙️ {exportProgress.phase}</span>
                <span>
                  {bnNum(
                    exportProgress.total > 0
                      ? Math.round((exportProgress.done / exportProgress.total) * 100)
                      : 0,
                  )}
                  %
                </span>
              </div>
              <Progress
                value={
                  exportProgress.total > 0
                    ? (exportProgress.done / exportProgress.total) * 100
                    : 0
                }
                className="h-3"
              />
              <p className="text-xs text-amber-700">
                ফ্রেম {bnNum(exportProgress.done)} / {bnNum(exportProgress.total)}
              </p>
              <Button
                variant="outline"
                className="w-full border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={() => {
                  cancelExportRef.current = true;
                }}
                disabled={cancelExportRef.current}
              >
                বাতিল করুন
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-900">রেজোলিউশন</Label>
                  <Select
                    value={exportQuality}
                    onValueChange={(v) => setExportQuality(v as "720" | "1080")}
                  >
                    <SelectTrigger className="border-amber-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="720">720p HD</SelectItem>
                      <SelectItem value="1080">1080p Full HD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-amber-900">ফ্রেমরেট</Label>
                  <Select
                    value={String(exportFps)}
                    onValueChange={(v) => setExportFps(Number(v))}
                  >
                    <SelectTrigger className="border-amber-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="24">২৪fps (সিনেমা)</SelectItem>
                      <SelectItem value="30">৩০fps (স্মুথ)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-900">
                  কী এক্সপোর্ট হবে?
                </Label>
                {scenes.length > 1 ? (
                  <RadioGroup
                    value={exportScope}
                    onValueChange={(v) => setExportScope(v as "episode" | "scene")}
                    className="grid grid-cols-2 gap-2"
                  >
                    <label
                      htmlFor="scope-episode"
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                        exportScope === "episode"
                          ? "border-orange-600 bg-orange-50 text-orange-800"
                          : "border-amber-200 bg-white text-amber-900 hover:bg-amber-50"
                      }`}
                    >
                      <RadioGroupItem value="episode" id="scope-episode" />
                      🎞️ সম্পূর্ণ এপিসোড ({bnNum(scenes.length)} দৃশ্য)
                    </label>
                    <label
                      htmlFor="scope-scene"
                      className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-semibold transition-colors ${
                        exportScope === "scene"
                          ? "border-orange-600 bg-orange-50 text-orange-800"
                          : "border-amber-200 bg-white text-amber-900 hover:bg-amber-50"
                      }`}
                    >
                      <RadioGroupItem value="scene" id="scope-scene" />
                      🎬 শুধু এই দৃশ্যটি
                    </label>
                  </RadioGroup>
                ) : (
                  <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">
                    🎬 শুধু বর্তমান দৃশ্যটি এক্সপোর্ট হবে। একাধিক দৃশ্য বানালে সম্পূর্ণ এপিসোড এক ভিডিওতে আসবে!
                  </p>
                )}
                {exportScope === "episode" && scenes.length > 1 && (
                  <p className="text-xs text-amber-600">
                    দৃশ্যগুলো ক্রমানুসারে এক ভিডিওতে আসবে — দৃশ্য বদলে ছোট ফেড, মোট ~{bnNum(episodeTiming(scenes, (id) => getCachedAudio(id)).total.toFixed(1))} সেকেন্ড।
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-amber-900">কথার নাম-ট্যাগ</p>
                  <p className="text-xs text-amber-700">কে বলছে সেটা ভিডিওতে দেখাবে</p>
                </div>
                <Switch
                  checked={exportTags}
                  onCheckedChange={setExportTags}
                  aria-label="নাম-ট্যাগ চালু/বন্ধ"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-amber-900">ফেড-ইন / ফেড-আউট</p>
                  <p className="text-xs text-amber-700">শুরু ও শেষে সিনেমার মতো পলিশড ফেড</p>
                </div>
                <Switch
                  checked={exportFade}
                  onCheckedChange={setExportFade}
                  aria-label="ফেড চালু/বন্ধ"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-amber-900">
                  টাইটেল কার্ড (ঐচ্ছিক)
                </Label>
                <Input
                  value={exportTitle}
                  onChange={(e) => setExportTitle(e.target.value)}
                  placeholder="যেমন: গোপাল ভাঁড় ও মিথ্যে সাক্ষী"
                  className="border-amber-300"
                />
                <p className="text-xs text-amber-600">
                  লিখলে ভিডিওর শুরুতে ২ সেকেন্ডের সুন্দর টাইটেল কার্ড আসবে।
                </p>
              </div>

              <div
                className={`rounded-lg border px-3 py-2 text-xs ${
                  fastExport
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-amber-300 bg-amber-50 text-amber-800"
                }`}
              >
                {fastExport
                  ? "⚡ দ্রুত এক্সপোর্ট ইঞ্জিন রেডি — রিয়েল-টাইমের চেয়ে অনেক কম সময়ে MP4 (H.264) তৈরি হবে।"
                  : "ℹ️ এই ব্রাউজারে দ্রুত ইঞ্জিন নেই — রিয়েল-টাইম রেকর্ডিং হবে (কার্টুনের সমান সময় লাগবে)। Chrome ব্যবহার করলে দ্রুত MP4 পাবেন।"}
              </div>

              {fastExport ? (
                <Button
                  onClick={runFastExport}
                  className="w-full bg-orange-600 text-white hover:bg-orange-700"
                >
                  <Film className="mr-2 h-4 w-4" /> MP4 এক্সপোর্ট শুরু করুন
                </Button>
              ) : (
                <Button
                  onClick={() => {
                    setExportOpen(false);
                    exportRealtime();
                  }}
                  className="w-full bg-orange-600 text-white hover:bg-orange-700"
                >
                  <Film className="mr-2 h-4 w-4" /> রিয়েল-টাইম রেকর্ডিং শুরু করুন
                </Button>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ---------- Template picker (Phase 1) ---------- */}
      <Dialog open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-orange-800">রেডিমেড টেমপ্লেট</DialogTitle>
            <DialogDescription>
              এক ক্লিকে সাজানো মজার দৃশ্য — প্লে করে দেখুন, তারপর নিজের মতো বদলে ফেলুন।
              বর্তমান দৃশ্য বদলে যাবে, তবে Ctrl+Z দিয়ে সবসময় ফিরে আসা যায়।
            </DialogDescription>
          </DialogHeader>
          <div className="thatta-scroll max-h-80 space-y-2.5 overflow-y-auto pr-1">
            {TEMPLATES.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3"
              >
                <span className="text-3xl" aria-hidden>
                  {t.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-amber-950">{t.name}</p>
                  <p className="text-xs leading-snug text-amber-700">{t.desc}</p>
                </div>
                <Button
                  size="sm"
                  onClick={() => handleLoadTemplate(t.id)}
                  className="shrink-0 bg-orange-600 text-white hover:bg-orange-700"
                >
                  লোড করুন
                </Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Crash recovery dialog (Phase 1) ---------- */}
      <Dialog
        open={recoverAt != null}
        onOpenChange={(o) => {
          if (!o) setRecoverAt(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-800">
              শেষবার অ্যাপ হঠাৎ বন্ধ হয়েছিল
            </DialogTitle>
            <DialogDescription>
              {recoverAt != null && (
                <>
                  আপনার কাজের স্বয়ংক্রিয় ব্যাকআপ পাওয়া গেছে (সময়:{" "}
                  {new Date(recoverAt).toLocaleTimeString("bn-BD", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  )। বর্তমান অবস্থাও রক্ষা পেয়েছে — দরকার হলে ব্যাকআপ থেকে ফিরিয়ে আনুন।
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              onClick={handleRestoreBackup}
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              💾 ব্যাকআপ রিস্টোর করুন
            </Button>
            <Button
              variant="outline"
              onClick={() => setRecoverAt(null)}
              className="flex-1 border-amber-300"
            >
              বর্তমান অবস্থা রাখুন
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Keyboard shortcuts cheat-sheet ---------- */}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-w-md rounded-2xl border-amber-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-900">
              <Keyboard className="h-5 w-5 text-amber-600" /> কীবোর্ড শর্টকাট
            </DialogTitle>
            <DialogDescription>
              দ্রুত কাজ করার জন্য এই চাবিগুলো মনে রাখুন — টাইপ করার সময় চলবে না।
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-2">
            {SHORTCUTS.map((s) => (
              <div
                key={s.keys}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2"
              >
                <span className="text-sm text-amber-900">{s.label}</span>
                <kbd className="rounded-md border border-amber-300 bg-white px-2 py-0.5 font-mono text-xs font-semibold text-orange-800 shadow-sm">
                  {s.keys}
                </kbd>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* ---------- Guided tour (Phase 1) ---------- */}
      <GuidedTour
        steps={TOUR_STEPS}
        open={tourOpen}
        onClose={() => {
          markTourDone();
          setTourOpen(false);
        }}
      />
    </div>
  );
}
