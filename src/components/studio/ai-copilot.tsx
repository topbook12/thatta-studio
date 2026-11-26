"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 9: AI সহকারী ডায়ালগ
//
// Two copilots, one dialog:
//  1. 💡 আইডিয়া — 3 Bangla comedy premises → pick one → AI
//     storyboard → script draft (in the exact parser format) →
//     hands off to the ScriptDialog (existing apply pipeline).
//  2. 🗣 পাঞ্চ-আপ — dialogue lines of a chosen scene get funnier
//     versions; applying replaces the beat text (audio cache is
//     invalidated so TTS re-records automatically).
//
// Offline: the whole dialog is hidden by the parent when offline
// (graceful degradation — core studio never depends on AI).
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { aiPost } from "@/lib/ai-client";
import { useStudio } from "@/lib/store";
import { clearCachedAudio } from "@/lib/tts-cache";
import type { EpisodeScene } from "@/lib/cartoon/types";
import { Bot, Lightbulb, Loader2, Send, Sparkles, Wand2 } from "lucide-react";

const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

interface Idea {
  title: string;
  premise: string;
}

interface PunchSuggestion {
  id: string;
  original: string;
  suggestion: string;
  note: string;
  /** designId of the speaking actor (for display) */
  who: string;
}

interface PunchTarget {
  sceneId: string;
  beatId: string;
}

export default function AiCopilot({
  open,
  onOpenChange,
  onSendToScript,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** hand the AI script draft to the ScriptDialog (Phase 2 pipeline) */
  onSendToScript: (script: string) => void;
}) {
  const scenes = useStudio((s) => s.scenes);
  const activeSceneId = useStudio((s) => s.activeSceneId);
  const designs = useStudio((s) => s.designs);

  // ---- ideas tab ----
  const [tab, setTab] = useState("ideas");
  const [topic, setTopic] = useState("");
  const [ideas, setIdeas] = useState<Idea[] | null>(null);
  const [loadingIdeas, setLoadingIdeas] = useState(false);
  const [loadingBoard, setLoadingBoard] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  // ---- punch-up tab ----
  const [punchSceneId, setPunchSceneId] = useState<string>("");
  const [punchLines, setPunchLines] = useState<PunchSuggestion[] | null>(null);
  const [punchTargets, setPunchTargets] = useState<PunchTarget[]>([]);
  const [loadingPunch, setLoadingPunch] = useState(false);
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  const castNames = useMemo(() => designs.map((d) => d.name), [designs]);

  const designNameOf = (uid: string) => {
    for (const es of scenes) {
      const c = es.scene.characters.find((ch) => ch.uid === uid);
      if (c) return designs.find((d) => d.id === c.designId)?.name ?? null;
    }
    return null;
  };

  const fetchIdeas = async () => {
    setLoadingIdeas(true);
    setIdeas(null);
    setDraft(null);
    try {
      const out = await aiPost<{ ideas: Idea[] }>("/api/ai/story-ideas", {
        topic: topic.trim() || undefined,
        castNames,
      });
      setIdeas(out.ideas);
    } catch (e) {
      toast({
        title: "আইডিয়া আনা গেল না",
        description: e instanceof Error ? e.message : "অজানা সমস্যা",
        variant: "destructive",
      });
    } finally {
      setLoadingIdeas(false);
    }
  };

  const makeStoryboard = async (idea: Idea) => {
    setLoadingBoard(idea.title);
    setDraft(null);
    try {
      const out = await aiPost<{ script: string }>("/api/ai/storyboard", {
        title: idea.title,
        premise: idea.premise,
        castNames,
        scenes: 2,
      });
      setDraft(out.script);
      toast({
        title: "স্টোরিবোর্ড তৈরি হয়েছে ✨",
        description: "চাইলে নিচের বক্সে সংলাপ একটু ঘেঁটে নিন, তারপর স্ক্রিপ্ট এডিটরে পাঠান।",
      });
    } catch (e) {
      toast({
        title: "স্টোরিবোর্ড আনা গেল না",
        description: e instanceof Error ? e.message : "অজানা সমস্যা",
        variant: "destructive",
      });
    } finally {
      setLoadingBoard(null);
    }
  };

  const sendToScriptEditor = () => {
    if (!draft?.trim()) return;
    onSendToScript(draft.trim());
    onOpenChange(false);
    setDraft(null);
    setIdeas(null);
  };

  // punch-up: which scene's lines are we doctoring?
  const targetScene: EpisodeScene | undefined =
    scenes.find((es) => es.id === punchSceneId) ??
    scenes.find((es) => es.id === activeSceneId) ??
    scenes[0];

  const dialogueBeats = useMemo(
    () =>
      (targetScene?.scene.beats ?? []).filter(
        (b) => b.text.trim() && !appliedIds.has(b.id),
      ),
    [targetScene, appliedIds],
  );

  const fetchPunchUps = async () => {
    if (!targetScene || dialogueBeats.length === 0) return;
    setLoadingPunch(true);
    setPunchLines(null);
    try {
      const out = await aiPost<{
        suggestions: { id: string; text: string; note?: string }[];
      }>("/api/ai/punch-up", {
        castNames,
        lines: dialogueBeats.map((b) => ({ id: b.id, text: b.text })),
      });
      // keep the returned order aligned with the scene's beat order
      const byId = new Map(
        out.suggestions.map((s) => [s.id, { text: s.text, note: s.note ?? "" }]),
      );
      const merged: PunchSuggestion[] = [];
      const targets: PunchTarget[] = [];
      for (const b of dialogueBeats) {
        const hit = byId.get(b.id);
        if (!hit) continue;
        merged.push({
          id: b.id,
          original: b.text,
          suggestion: hit.text,
          note: hit.note,
          who: designNameOf(b.actorUid) ?? "",
        });
        targets.push({ sceneId: targetScene.id, beatId: b.id });
      }
      if (merged.length === 0) {
        throw new Error("AI এবার কিছু বলতে পারেনি — আবার চেষ্টা করুন");
      }
      setPunchLines(merged);
      setPunchTargets(targets);
    } catch (e) {
      toast({
        title: "পাঞ্চ-আপ আনা গেল না",
        description: e instanceof Error ? e.message : "অজানা সমস্যা",
        variant: "destructive",
      });
    } finally {
      setLoadingPunch(false);
    }
  };

  const applyPunch = (idx: number) => {
    const line = punchLines?.[idx];
    const target = punchTargets[idx];
    if (!line || !target) return;
    const st = useStudio.getState();
    // switch scenes first if the line lives elsewhere, then patch —
    // updateBeat always writes into the ACTIVE scene
    if (target.sceneId !== st.activeSceneId) st.setActiveSceneId(target.sceneId);
    st.updateBeat(target.beatId, { text: line.suggestion });
    // text changed → stale TTS cache for this beat must go
    clearCachedAudio(target.beatId);
    setAppliedIds((prev) => new Set(prev).add(target.beatId));
    setPunchLines((prev) =>
      prev ? prev.filter((_, i) => i !== idx) : prev,
    );
    setPunchTargets((prev) => prev.filter((_, i) => i !== idx));
    toast({
      title: "সংলাপ বসেছে 🎯",
      description: "পুরনো ভয়েস মুছে গেছে — ভয়েস জেনারেট করলেই নতুন গলা আসবে।",
    });
  };

  const sceneOptions = scenes.length > 0 ? scenes : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-800">
            <Bot className="h-5 w-5 text-orange-600" /> AI সহকারী — গল্প লেখায় মসীহ
          </DialogTitle>
          <DialogDescription>
            খালি স্টেজে বসে থাকা কঠিন! AI আইডিয়া দেয়, স্টোরিবোর্ড লেখে, সংলাপ ঝাঁঝালো
            করে — চূড়ান্ত সিদ্ধান্ত সবসময় তোমার।
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2 bg-amber-100">
            <TabsTrigger value="ideas" className="text-xs data-[state=active]:bg-white">
              💡 আইডিয়া ও স্টোরিবোর্ড
            </TabsTrigger>
            <TabsTrigger value="punch" className="text-xs data-[state=active]:bg-white">
              🗣 সংলাপ পাঞ্চ-আপ
            </TabsTrigger>
          </TabsList>

          {/* ---------------- IDEAS ---------------- */}
          <TabsContent value="ideas" className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="পছন্দের বিষয় — যেমন: বাজারে মিষ্টি কাণ্ড (ঐচ্ছিক)"
                className="border-amber-300"
                maxLength={200}
                aria-label="আইডিয়ার বিষয়"
              />
              <Button
                onClick={fetchIdeas}
                disabled={loadingIdeas}
                className="shrink-0 bg-orange-600 text-white hover:bg-orange-700"
              >
                {loadingIdeas ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Lightbulb className="mr-1.5 h-4 w-4" />
                )}
                আইডিয়া আনুন
              </Button>
            </div>

            {!ideas && !loadingIdeas && (
              <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">
                💡 তোমার {bnNum(castNames.length)} জন ক্যারেক্টারকে দেখে AI গল্প লিখবে।
                বিষয় না লিখলেও ৩টি সতেজ আইডিয়া আসবে।
              </p>
            )}

            {ideas && !draft && (
              <div className="thatta-scroll max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {ideas.map((idea, i) => (
                  <div
                    key={i}
                    className="rounded-xl border border-amber-200 bg-white p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-amber-950">
                          {bnNum(i + 1)}. {idea.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-amber-700">
                          {idea.premise}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => makeStoryboard(idea)}
                        disabled={loadingBoard !== null}
                        className="shrink-0 border-orange-300 text-xs text-orange-700 hover:bg-orange-50"
                      >
                        {loadingBoard === idea.title ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : (
                          <Wand2 className="mr-1 h-3 w-3" />
                        )}
                        স্টোরিবোর্ড
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {ideas && draft && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-amber-700">
                  ✏️ স্ক্রিপ্ট ড্রাফট — ইচ্ছে হলে এখানেই ঘেঁটে নাও:
                </p>
                <Textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={10}
                  className="border-amber-300 font-mono text-sm focus-visible:ring-orange-400"
                  aria-label="AI স্ক্রিপ্ট ড্রাফট"
                />
                <div className="flex justify-between gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDraft(null)}>
                    ← অন্য আইডিয়া দেখুন
                  </Button>
                  <Button
                    onClick={sendToScriptEditor}
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    <Send className="mr-1.5 h-4 w-4" /> স্ক্রিপ্ট এডিটরে পাঠান
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ---------------- PUNCH-UP ---------------- */}
          <TabsContent value="punch" className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={targetScene?.id ?? ""}
                onValueChange={(v) => {
                  setPunchSceneId(v);
                  setPunchLines(null);
                  setAppliedIds(new Set());
                }}
              >
                <SelectTrigger className="h-9 w-[220px] border-amber-300 text-xs">
                  <SelectValue placeholder="দৃশ্য বাছুন" />
                </SelectTrigger>
                <SelectContent>
                  {sceneOptions.map((es, i) => (
                    <SelectItem key={es.id} value={es.id} className="text-xs">
                      {bnNum(i + 1)}. {es.name || `দৃশ্য ${bnNum(i + 1)}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={fetchPunchUps}
                disabled={loadingPunch || dialogueBeats.length === 0}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                {loadingPunch ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-1.5 h-4 w-4" />
                )}
                পাঞ্চ-আপ করুন
              </Button>
              <span className="text-xs text-amber-600">
                {bnNum(dialogueBeats.length)}টি সংলাপ পাওয়া গেছে
              </span>
            </div>

            {!punchLines && !loadingPunch && (
              <p className="rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs text-amber-700">
                🗣 দৃশ্যের সংলাপগুলো AI-এর কাছে যাবে, আর AI প্রতিটির মজার সংস্করণ
                দেবে — ভালো লাগলে এক ট্যাপে বসিয়ে দাও। মূল অর্থ বদলাবে না।
              </p>
            )}

            {dialogueBeats.length === 0 && !loadingPunch && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                এই দৃশ্যে সংলাপ নেই — আগে কিছু বিটে সংলাপ লিখে আনুন।
              </p>
            )}

            {punchLines && punchLines.length > 0 && (
              <div className="thatta-scroll max-h-80 space-y-2.5 overflow-y-auto pr-1">
                {punchLines.map((line, i) => (
                  <div
                    key={line.id}
                    className="rounded-xl border border-amber-200 bg-white p-3"
                  >
                    <p className="text-[11px] font-semibold text-amber-500">
                      {line.who ? `${line.who}: ` : ""}
                      <span className="line-through decoration-amber-300">{line.original}</span>
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-amber-950">
                      ✨ {line.suggestion}
                    </p>
                    {line.note && (
                      <p className="mt-1 text-[11px] italic text-amber-600">
                        {line.note}
                      </p>
                    )}
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setPunchLines((prev) =>
                            prev ? prev.filter((_, k) => k !== i) : prev,
                          );
                          setPunchTargets((prev) => prev.filter((_, k) => k !== i));
                        }}
                        className="h-7 border-amber-200 text-[11px] text-amber-700"
                      >
                        বাদ দাও
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => applyPunch(i)}
                        className="h-7 bg-emerald-600 px-3 text-[11px] text-white hover:bg-emerald-700"
                      >
                        ✓ বসান
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {punchLines && punchLines.length === 0 && (
              <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                🎉 সব সাজেশন শেষ! ভয়েস জেনারেট করে শুনে নাও — নতুন গলা স্বয়ংক্রিয়ভাবে
                আসবে।
              </p>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
