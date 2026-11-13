"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  BOTTOM_STYLES,
  BROW_STYLES,
  BEARD_STYLES,
  CLOTH_COLORS,
  EYE_STYLES,
  HAIR_COLORS,
  HAIR_STYLES,
  HEADWEAR_STYLES,
  MOUTH_STYLES,
  SKIN_TONES,
  TOP_STYLES,
  VOICE_OPTIONS,
  makeDesign,
  newId,
} from "@/lib/cartoon/presets";
import { drawCharacter } from "@/lib/cartoon/draw";
import { computePose } from "@/lib/cartoon/pose";
import type { ActionName, CharacterDesign } from "@/lib/cartoon/types";
import { AudioLines, Eraser, Pencil, Save, Sparkles, Trash2, Volume2 } from "lucide-react";
import { generateVoice } from "@/lib/tts-cache";

// ---------------- mini avatar (static render) ----------------

function MiniAvatar({ design }: { design: CharacterDesign }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const key = JSON.stringify(design);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#fef3c7");
    g.addColorStop(1, "#fde1b9");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height - 14);
    const s = (canvas.height - 36) / 230;
    ctx.scale(s, s);
    drawCharacter(ctx, design, computePose("idle", 0.4, false), 0.4);
    ctx.restore();
  }, [key]);
  return (
    <canvas
      ref={ref}
      width={78}
      height={100}
      className="rounded-lg border border-amber-200"
      aria-label={`${design.name} ক্যারেক্টারের ছবি`}
    />
  );
}

// ---------------- animated preview ----------------

const PREVIEW_ACTIONS: ActionName[] = [
  "idle",
  "talk",
  "walk",
  "wave",
  "laugh",
  "point",
  "angry",
  "jump",
  "nod",
  "cry",
  "clap",
  "salute",
  "carry",
];

function CharacterPreview({
  design,
  action,
}: {
  design: CharacterDesign;
  action: ActionName;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const designKey = JSON.stringify(design);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const loop = (ts: number) => {
      raf = requestAnimationFrame(loop);
      const t = (ts - start) / 1000;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
      g.addColorStop(0, "#fffbeb");
      g.addColorStop(1, "#fde1b9");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      // floor
      ctx.fillStyle = "#fbbf24";
      ctx.fillRect(0, canvas.height - 60, canvas.width, 60);
      ctx.fillStyle = "#f59e0b";
      ctx.fillRect(0, canvas.height - 60, canvas.width, 4);
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height - 52);
      const s = (canvas.height - 110) / 230;
      ctx.scale(s, s);
      const speaking = action === "talk";
      drawCharacter(ctx, design, computePose(action, t, speaking), t);
      ctx.restore();
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [designKey, action]);

  return (
    <canvas
      ref={ref}
      width={420}
      height={520}
      className="w-full rounded-xl border border-amber-200"
      aria-label="ক্যারেক্টার প্রিভিউ"
    />
  );
}

// ---------------- reusable pickers ----------------

function OptionChips({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => onChange(i)}
          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
            value === i
              ? "border-orange-600 bg-orange-600 text-white"
              : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function ColorSwatches({
  colors,
  value,
  onChange,
  label,
}: {
  colors: string[];
  value: string;
  onChange: (c: string) => void;
  label?: string;
}) {
  return (
    <div>
      {label && <p className="mb-1.5 text-xs font-medium text-amber-800">{label}</p>}
      <div className="flex flex-wrap gap-2">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`রঙ ${c}`}
            onClick={() => onChange(c)}
            className={`h-7 w-7 rounded-full border-2 transition-transform hover:scale-110 ${
              value === c ? "border-orange-700 ring-2 ring-orange-300" : "border-amber-200"
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold text-amber-900">{label}</Label>
      {children}
    </div>
  );
}

// ---------------- main tab ----------------

export default function CreatorTab() {
  const { designs, addDesign, updateDesign, deleteDesign } = useStudio();
  const [draft, setDraft] = useState<CharacterDesign>(() => makeDesign());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewAction, setPreviewAction] = useState<ActionName>("wave");
  const [testingVoice, setTestingVoice] = useState(false);

  const patch = (p: Partial<CharacterDesign>) => setDraft((d) => ({ ...d, ...p }));

  const skinLabel = useMemo(
    () => SKIN_TONES.find((t) => t.value === draft.skin)?.label ?? "",
    [draft.skin],
  );

  const startEdit = (d: CharacterDesign) => {
    setDraft({ ...d });
    setEditingId(d.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      toast({ title: "নাম দিন", description: "ক্যারেক্টারের একটা মজার নাম দিন!", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateDesign(editingId, draft);
      toast({ title: "আপডেট হয়েছে ✅", description: `${draft.name} ক্যারেক্টার আপডেট হয়েছে।` });
    } else {
      const d = { ...draft, id: newId() };
      addDesign(d);
      setDraft(d);
      setEditingId(d.id);
      toast({ title: "সেভ হয়েছে 🎉", description: `${d.name} এখন স্টুডিওতে ব্যবহার করা যাবে।` });
    }
  };

  const handleNew = () => {
    setDraft(makeDesign());
    setEditingId(null);
    toast({ title: "নতুন ক্যারেক্টর", description: "নতুন চেহারা সাজানো শুরু করুন!" });
  };

  const handleVoiceTest = async () => {
    if (testingVoice) return;
    setTestingVoice(true);
    try {
      const { url } = await generateVoice("ওই মামা, কী রে? আমার কণ্ঠ কেমন লাগছে?", draft.voice);
      const el = new Audio(url);
      el.onended = () => setTestingVoice(false);
      await el.play();
      setTimeout(() => setTestingVoice(false), 8000);
    } catch {
      toast({
        title: "ভয়েস তৈরি করা যায়নি",
        description: "একটু পরে আবার চেষ্টা করুন।",
        variant: "destructive",
      });
      setTestingVoice(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(300px,420px)_1fr]">
      {/* Preview column */}
      <div className="space-y-4 lg:sticky lg:top-24 lg:self-start">
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <Sparkles className="h-4 w-4 text-amber-500" />
              লাইভ প্রিভিউ
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <CharacterPreview design={draft} action={previewAction} />
            <div>
              <p className="mb-1.5 text-xs font-medium text-amber-800">
                অ্যাকশন টেস্ট করুন:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ACTION_OPTIONS.filter((a) => PREVIEW_ACTIONS.includes(a.id)).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setPreviewAction(a.id)}
                    className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                      previewAction === a.id
                        ? "border-orange-600 bg-orange-600 text-white"
                        : "border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
                    }`}
                  >
                    {a.emoji} {a.label}
                  </button>
                ))}
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleVoiceTest}
              disabled={testingVoice}
              className="w-full border-teal-300 text-teal-800 hover:bg-teal-50"
            >
              <Volume2 className="mr-2 h-4 w-4" />
              {testingVoice ? "ভয়েস চলছে..." : "ভয়েস টেস্ট করুন"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Controls column */}
      <div className="space-y-6">
        {/* Saved designs */}
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-800">
              সেভ করা ক্যারেক্টার ({designs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="thatta-scroll grid max-h-56 gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
              {designs.map((d) => (
                <div
                  key={d.id}
                  className={`flex items-center gap-3 rounded-xl border p-2.5 ${
                    editingId === d.id
                      ? "border-orange-400 bg-orange-50"
                      : "border-amber-200 bg-white"
                  }`}
                >
                  <MiniAvatar design={d} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-amber-950">{d.name}</p>
                    <p className="text-xs text-amber-700">
                      {d.gender === "female" ? "মেয়ে" : "ছেলে"} •{" "}
                      {VOICE_OPTIONS.find((v) => v.id === d.voice)?.label.split(" ")[0] ?? d.voice}
                    </p>
                    <div className="mt-1.5 flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={() => startEdit(d)}
                      >
                        <Pencil className="mr-1 h-3 w-3" />
                        এডিট
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 border-rose-200 px-2 text-xs text-rose-700 hover:bg-rose-50"
                        onClick={() => {
                          deleteDesign(d.id);
                          if (editingId === d.id) {
                            setEditingId(null);
                            setDraft(makeDesign());
                          }
                          toast({ title: "মুছে ফেলা হয়েছে", description: `${d.name} ডিলিট হয়েছে।` });
                        }}
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        ডিলিট
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
              {designs.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-amber-700">
                  এখনো কোনো ক্যারেক্টার সেভ করা হয়নি — নিচের ফর্মে প্রথম ক্যারেক্টার সাজান! 🎨
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Builder */}
        <Card className="border-amber-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-orange-800">
              {editingId ? `সম্পাদনা: ${draft.name}` : "নতুন ক্যারেক্টার সাজান"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="নাম">
                <Input
                  value={draft.name}
                  onChange={(e) => patch({ name: e.target.value })}
                  placeholder="যেমন: গোপাল, মশিমা, দাদু..."
                  className="border-amber-300 focus-visible:ring-orange-400"
                />
              </Field>
              <Field label="জেন্ডার">
                <Select
                  value={draft.gender}
                  onValueChange={(v) => patch({ gender: v as "male" | "female" })}
                >
                  <SelectTrigger className="border-amber-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">ছেলে</SelectItem>
                    <SelectItem value="female">মেয়ে</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field label={`স্কিন রঙ${skinLabel ? ` — ${skinLabel}` : ""}`}>
              <ColorSwatches
                colors={SKIN_TONES.map((t) => t.value)}
                value={draft.skin}
                onChange={(c) => patch({ skin: c })}
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="চুল">
                <OptionChips
                  options={HAIR_STYLES}
                  value={draft.hairStyle}
                  onChange={(i) => patch({ hairStyle: i })}
                />
                <div className="mt-2">
                  <ColorSwatches
                    colors={HAIR_COLORS}
                    value={draft.hairColor}
                    onChange={(c) => patch({ hairColor: c })}
                    label="চুলের রঙ"
                  />
                </div>
              </Field>
              <Field label="মাথায় কী থাকবে">
                <OptionChips
                  options={HEADWEAR_STYLES}
                  value={draft.headwearStyle}
                  onChange={(i) => patch({ headwearStyle: i })}
                />
                <div className="mt-2">
                  <ColorSwatches
                    colors={CLOTH_COLORS}
                    value={draft.headwearColor}
                    onChange={(c) => patch({ headwearColor: c })}
                    label="টুপির রঙ"
                  />
                </div>
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="চোখ">
                <OptionChips
                  options={EYE_STYLES}
                  value={draft.eyeStyle}
                  onChange={(i) => patch({ eyeStyle: i })}
                />
              </Field>
              <Field label="ভুরু">
                <OptionChips
                  options={BROW_STYLES}
                  value={draft.browStyle}
                  onChange={(i) => patch({ browStyle: i })}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="মুখ">
                <OptionChips
                  options={MOUTH_STYLES}
                  value={draft.mouthStyle}
                  onChange={(i) => patch({ mouthStyle: i })}
                />
              </Field>
              <Field label="দাড়ি / গোঁফ">
                <OptionChips
                  options={BEARD_STYLES}
                  value={draft.beardStyle}
                  onChange={(i) => patch({ beardStyle: i })}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="উপরের পোশাক">
                <OptionChips
                  options={TOP_STYLES}
                  value={draft.topStyle}
                  onChange={(i) => patch({ topStyle: i })}
                />
                <div className="mt-2">
                  <ColorSwatches
                    colors={CLOTH_COLORS}
                    value={draft.topColor}
                    onChange={(c) => patch({ topColor: c })}
                    label="পোশাকের রঙ"
                  />
                </div>
              </Field>
              <Field label="নিচের পোশাক">
                <OptionChips
                  options={BOTTOM_STYLES}
                  value={draft.bottomStyle}
                  onChange={(i) => patch({ bottomStyle: i })}
                />
                <div className="mt-2">
                  <ColorSwatches
                    colors={CLOTH_COLORS}
                    value={draft.bottomColor}
                    onChange={(c) => patch({ bottomColor: c })}
                    label="পোশাকের রঙ"
                  />
                </div>
              </Field>
            </div>

            <div className="grid items-center gap-4 sm:grid-cols-2">
              <Field label="চশমা">
                <div className="flex items-center gap-3">
                  <Switch
                    checked={draft.glasses}
                    onCheckedChange={(v) => patch({ glasses: v })}
                    aria-label="চশমা চালু/বন্ধ"
                  />
                  <span className="text-sm text-amber-800">
                    {draft.glasses ? "চশমা পরা 😎" : "চশমা নেই"}
                  </span>
                </div>
              </Field>
              <Field label="ভয়েস (কণ্ঠ)">
                <div className="flex gap-2">
                  <Select value={draft.voice} onValueChange={(v) => patch({ voice: v })}>
                    <SelectTrigger className="border-amber-300">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOICE_OPTIONS.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={handleVoiceTest}
                    disabled={testingVoice}
                    className="shrink-0 border-teal-300 text-teal-800 hover:bg-teal-50"
                    aria-label="ভয়েস টেস্ট"
                  >
                    <AudioLines className="h-4 w-4" />
                  </Button>
                </div>
              </Field>
            </div>

            <div className="flex flex-wrap gap-3 border-t border-amber-100 pt-4">
              <Button
                onClick={handleSave}
                className="bg-orange-600 text-white hover:bg-orange-700"
              >
                <Save className="mr-2 h-4 w-4" />
                {editingId ? "আপডেট করুন" : "সেভ করুন"}
              </Button>
              <Button
                variant="outline"
                onClick={handleNew}
                className="border-amber-300 text-amber-900 hover:bg-amber-100"
              >
                <Eraser className="mr-2 h-4 w-4" />
                নতুন ক্যারেক্টার
              </Button>
              {editingId && (
                <span className="self-center text-xs text-amber-700">
                  এডিট করছেন: <b>{draft.name}</b>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
