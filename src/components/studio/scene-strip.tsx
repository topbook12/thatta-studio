"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 2: মাল্টি-সিন এপিসোড scene manager strip
//
// Horizontal list of the episode's scenes: switch, add, duplicate,
// rename, reorder, delete. Switching/structural changes stop any
// playback first (via onStopPlayback) so the stage never half-plays.
// ============================================================

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { toast } from "@/hooks/use-toast";
import { useStudio } from "@/lib/store";
import { episodeTiming } from "@/lib/cartoon/episode";
import type { SceneTransition } from "@/lib/cartoon/types";
import { getCachedAudio } from "@/lib/tts-cache";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

const TRANSITION_OPTIONS: { id: SceneTransition; label: string; emoji: string }[] = [
  { id: "cut", label: "সরাসরি কাট", emoji: "✂️" },
  { id: "fade", label: "কালোতে ফেড", emoji: "🌑" },
  { id: "circle", label: "সার্কেল ওয়াইপ", emoji: "⭕" },
];

/** sanity cap — keeps rendering + export memory predictable */
export const MAX_SCENES = 12;

export default function SceneStrip({
  audioVersion,
  onStopPlayback,
}: {
  /** bump when voices change so chip durations stay audio-aware */
  audioVersion: number;
  /** called before switching/adding/deleting while playing */
  onStopPlayback?: () => void;
}) {
  const scenes = useStudio((s) => s.scenes);
  const activeSceneId = useStudio((s) => s.activeSceneId);
  const setActiveSceneId = useStudio((s) => s.setActiveSceneId);
  const addScene = useStudio((s) => s.addScene);
  const duplicateScene = useStudio((s) => s.duplicateScene);
  const deleteScene = useStudio((s) => s.deleteScene);
  const renameScene = useStudio((s) => s.renameScene);
  const moveScene = useStudio((s) => s.moveScene);
  const setSceneTransition = useStudio((s) => s.setSceneTransition);

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string; beats: number } | null>(
    null,
  );

  const timing = useMemo(
    () => episodeTiming(scenes, (id) => getCachedAudio(id)),
    [scenes, audioVersion],
  );

  const activeIndex = Math.max(
    0,
    scenes.findIndex((es) => es.id === activeSceneId),
  );
  const activeScene = scenes[activeIndex];

  // keyboard navigation: [ / ] jump between scenes (never while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.tagName === "SELECT" ||
          el.isContentEditable)
      ) {
        return;
      }
      const at = scenes.findIndex((s) => s.id === activeSceneId);
      if (e.key === "[" && at > 0) {
        onStopPlayback?.();
        setActiveSceneId(scenes[at - 1].id);
      } else if (e.key === "]" && at < scenes.length - 1) {
        onStopPlayback?.();
        setActiveSceneId(scenes[at + 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scenes, activeSceneId, setActiveSceneId, onStopPlayback]);

  const switchScene = (id: string) => {
    if (id === activeSceneId) return;
    onStopPlayback?.();
    setActiveSceneId(id);
  };

  const handleAdd = () => {
    if (scenes.length >= MAX_SCENES) {
      toast({
        title: "দৃশ্যের সর্বোচ্চ সীমা",
        description: `এক এপিসোডে সর্বোচ্চ ${bnNum(MAX_SCENES)}টি দৃশ্য রাখা যায়।`,
        variant: "destructive",
      });
      return;
    }
    onStopPlayback?.();
    addScene();
    toast({
      title: "নতুন দৃশ্য যোগ হয়েছে 🎞️",
      description: "একই ক্যারেক্টার ও ব্যাকগ্রাউন্ড থাকবে — টাইমলাইনে নতুন বিট যোগ করুন।",
    });
  };

  const handleDuplicate = (id: string) => {
    if (scenes.length >= MAX_SCENES) {
      toast({
        title: "দৃশ্যের সর্বোচ্চ সীমা",
        description: `এক এপিসোডে সর্বোচ্চ ${bnNum(MAX_SCENES)}টি দৃশ্য রাখা যায়।`,
        variant: "destructive",
      });
      return;
    }
    onStopPlayback?.();
    duplicateScene(id);
    toast({ title: "দৃশ্য কপি হয়েছে 📄", description: "সব বিট ও ক্যারেক্টার সহ সম্পূর্ণ কপি।" });
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const wasActive = deleteTarget.id === activeSceneId;
    if (wasActive) onStopPlayback?.();
    deleteScene(deleteTarget.id);
    toast({
      title: `"${deleteTarget.name}" মুছে ফেলা হয়েছে`,
      description: "ভুল হলে Ctrl+Z চাপুন — দৃশ্যটি ফিরে আসবে।",
    });
    setDeleteTarget(null);
  };

  const submitRename = () => {
    if (renameId && renameValue.trim()) {
      renameScene(renameId, renameValue);
    }
    setRenameId(null);
    setRenameValue("");
  };

  return (
    <div
      id="tour-scenes"
      className="rounded-xl border border-amber-200 bg-amber-50/70 p-2.5"
      role="region"
      aria-label="এপিসোডের দৃশ্য তালিকা"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-amber-900">
          🎞️ এপিসোডের দৃশ্যগুলো{" "}
          <span className="ml-1 text-xs font-medium text-amber-700">
            (চর্চা: [ ও ] চাপে আগের/পরের দৃশ্য)
          </span>
        </p>
        <span className="rounded-full border border-amber-300 bg-white px-2.5 py-1 text-xs font-semibold text-orange-800">
          {bnNum(scenes.length)}টি দৃশ্য • মোট {bnNum(timing.total.toFixed(1))} সে.
        </span>
      </div>

      <div className="thatta-scroll flex gap-2 overflow-x-auto pb-1">
        {scenes.map((es, i) => {
          const active = es.id === activeSceneId;
          const dur = timing.scenes[i]?.duration ?? 0;
          return (
            <div
              key={es.id}
              className={`flex shrink-0 items-center rounded-xl border transition-colors ${
                active
                  ? "border-orange-600 bg-white shadow-sm ring-2 ring-orange-600/20"
                  : "border-amber-200 bg-white/80 hover:border-amber-400"
              }`}
            >
              <button
                type="button"
                onClick={() => switchScene(es.id)}
                className="flex items-center gap-2 px-3 py-2 text-left"
                aria-current={active ? "true" : undefined}
                title={`${es.name} — ${dur.toFixed(1)} সেকেন্ড`}
              >
                <span
                  className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    active
                      ? "bg-orange-600 text-white"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {bnNum(i + 1)}
                </span>
                <span className="min-w-0">
                  <span
                    className={`block max-w-[9rem] truncate text-sm font-semibold ${
                      active ? "text-orange-800" : "text-amber-900"
                    }`}
                  >
                    {es.name}
                  </span>
                  <span className="block text-[11px] text-amber-600">
                    {bnNum(dur.toFixed(1))} সে. • {bnNum(es.scene.beats.length)} বিট
                  </span>
                </span>
              </button>
              {active && (
                <div className="flex items-center gap-0.5 pr-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 px-0 text-amber-700 hover:text-orange-800"
                    onClick={() => handleDuplicate(es.id)}
                    disabled={scenes.length >= MAX_SCENES}
                    title="এই দৃশ্যের কপি বানান"
                    aria-label="দৃশ্য কপি করুন"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 px-0 text-amber-700 hover:text-orange-800"
                    onClick={() => {
                      setRenameId(es.id);
                      setRenameValue(es.name);
                    }}
                    title="নাম বদলান"
                    aria-label="দৃশ্যের নাম বদলান"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 px-0 text-amber-700"
                    onClick={() => moveScene(es.id, -1)}
                    disabled={i === 0}
                    title="এক ঘর আগে সরান"
                    aria-label="দৃশ্য আগে সরান"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 px-0 text-amber-700"
                    onClick={() => moveScene(es.id, 1)}
                    disabled={i === scenes.length - 1}
                    title="এক ঘর পরে সরান"
                    aria-label="দৃশ্য পরে সরান"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 px-0 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                    onClick={() =>
                      setDeleteTarget({
                        id: es.id,
                        name: es.name,
                        beats: es.scene.beats.length,
                      })
                    }
                    disabled={scenes.length <= 1}
                    title="দৃশ্য মুছুন"
                    aria-label="দৃশ্য মুছুন"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={handleAdd}
          disabled={scenes.length >= MAX_SCENES}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border-2 border-dashed border-amber-300 px-3.5 py-2 text-sm font-semibold text-amber-700 transition-colors hover:border-orange-400 hover:bg-orange-50 hover:text-orange-800 disabled:cursor-not-allowed disabled:opacity-50"
          title="পরের দৃশ্য যোগ করুন"
        >
          <Plus className="h-4 w-4" /> নতুন দৃশ্য
        </button>
      </div>

      {/* outgoing transition of the ACTIVE scene (applied in MP4 export) */}
      {scenes.length > 1 && activeIndex < scenes.length - 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-amber-200 pt-2">
          <span className="text-xs font-semibold text-amber-800">
            "{activeScene?.name}" শেষে →
          </span>
          <Select
            value={activeScene?.transition ?? "cut"}
            onValueChange={(v) => activeScene && setSceneTransition(activeScene.id, v as SceneTransition)}
          >
            <SelectTrigger
              className="h-8 w-[190px] border-amber-300 bg-white text-xs"
              aria-label="পরের দৃশ্যে ট্রানজিশন"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSITION_OPTIONS.map((o) => (
                <SelectItem key={o.id} value={o.id} className="text-xs">
                  {o.emoji} {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-[11px] text-amber-600">
            এক্সপোর্ট ভিডিওতে প্রয়োগ হবে (প্রিভিউতে কাট দেখাবে)
          </span>
        </div>
      )}

      {/* rename dialog */}
      <Dialog
        open={renameId != null}
        onOpenChange={(o) => {
          if (!o) {
            setRenameId(null);
            setRenameValue("");
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-orange-800">দৃশ্যের নাম বদলান</DialogTitle>
            <DialogDescription>
              যেমন: বাজারে গন্ডগোল, মামার রাগ, শেষ হাসি...
            </DialogDescription>
          </DialogHeader>
          <Input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submitRename();
            }}
            maxLength={40}
            autoFocus
            aria-label="দৃশ্যের নতুন নাম"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameId(null)}>
              বাতিল
            </Button>
            <Button
              onClick={submitRename}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              সেভ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* delete confirm */}
      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => {
          if (!o) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              "{deleteTarget?.name}" মুছে ফেলবেন?
            </AlertDialogTitle>
            <AlertDialogDescription>
              এই দৃশ্যের {bnNum(deleteTarget?.beats ?? 0)}টি বিট ও সংলাপও মুছে যাবে।
              ভুল হলে Ctrl+Z দিয়ে ফিরিয়ে আনা যাবে।
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>রেখে দিন</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-rose-600 text-white hover:bg-rose-700"
            >
              হ্যাঁ, মুছুন
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
