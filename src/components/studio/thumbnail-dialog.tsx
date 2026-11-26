"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 6: থাম্বনেইল জেনারেটর (টাইটেল-কার্ড ডিজাইনার)
//
// YouTube/Facebook thumbnail designer: live 1280×720 canvas with
// Bangla typography, 4 hand-made themes and an optional captured
// stage frame as the backdrop. One click → PNG download.
// ============================================================

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { aiPost, useIsOnline } from "@/lib/ai-client";
import { useStudio } from "@/lib/store";
import { Download, ImageIcon, Loader2, Palette, Sparkles } from "lucide-react";

interface ThumbnailDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** suggested title (episode/project name) */
  defaultTitle?: string;
  /** current stage frame as a JPEG data URL (backdrop mode) */
  getStageFrame?: () => string | null;
}

type ThemeId = "golden" | "night" | "field" | "mela";

interface Theme {
  id: ThemeId;
  label: string;
  sky: [string, string];
  accent: string;
  text: string;
  sub: string;
  deco: "sun" | "stars" | "paddy" | "flags";
}

const THEMES: Theme[] = [
  {
    id: "golden",
    label: "🌤️ সোনালি দুপুর",
    sky: ["#fbbf24", "#f97316"],
    accent: "#7c2d12",
    text: "#451a03",
    sub: "#7c2d12",
    deco: "sun",
  },
  {
    id: "night",
    label: "🌃 রাতের গ্রাম",
    sky: ["#1e3a5f", "#0f172a"],
    accent: "#fbbf24",
    text: "#fef3c7",
    sub: "#93c5fd",
    deco: "stars",
  },
  {
    id: "field",
    label: "🌾 সবুজ খেত",
    sky: ["#84cc16", "#16a34a"],
    accent: "#365314",
    text: "#f7fee7",
    sub: "#d9f99d",
    deco: "paddy",
  },
  {
    id: "mela",
    label: "🎪 মেলা",
    sky: ["#dc2626", "#7c3aed"],
    accent: "#fbbf24",
    text: "#fff7ed",
    sub: "#fde68a",
    deco: "flags",
  },
];

const W = 1280;
const H = 720;

interface ThumbSuggestion {
  title: string;
  subtitle: string;
}

export default function ThumbnailDialog({
  open,
  onOpenChange,
  defaultTitle = "",
  getStageFrame,
}: ThumbnailDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [title, setTitle] = useState(defaultTitle);
  const [subtitle, setSubtitle] = useState("বাংলা কার্টুন");
  const [theme, setTheme] = useState<ThemeId>("golden");
  const [useFrame, setUseFrame] = useState(true);
  const frameImg = useRef<HTMLImageElement | null>(null);

  // ---- Phase 9 — AI title suggestions ----
  const online = useIsOnline();
  const scenes = useStudio((s) => s.scenes);
  const [thumbIdeas, setThumbIdeas] = useState<ThumbSuggestion[] | null>(null);
  const [loadingThumbIdeas, setLoadingThumbIdeas] = useState(false);

  /** first few dialogue lines of the episode → AI context */
  const episodeContext = useMemo(() => {
    const lines: string[] = [];
    for (const es of scenes) {
      for (const b of es.scene.beats) {
        if (b.text.trim()) lines.push(b.text.trim());
        if (lines.length >= 4) return lines.join(" / ");
      }
    }
    return "";
  }, [scenes]);

  const fetchThumbIdeas = async () => {
    setLoadingThumbIdeas(true);
    setThumbIdeas(null);
    try {
      const out = await aiPost<{ items: ThumbSuggestion[] }>(
        "/api/ai/thumbnail-text",
        {
          title: defaultTitle || title,
          premise: episodeContext || undefined,
        },
      );
      setThumbIdeas(out.items);
    } catch (e) {
      toast({
        title: "সাজেশন আনা গেল না",
        description: e instanceof Error ? e.message : "অজানা সমস্যা",
        variant: "destructive",
      });
    } finally {
      setLoadingThumbIdeas(false);
    }
  };

  useEffect(() => {
    if (open) setTitle(defaultTitle);
  }, [open, defaultTitle]);

  const activeTheme = useMemo(
    () => THEMES.find((t) => t.id === theme) ?? THEMES[0],
    [theme],
  );

  // pre-load the stage frame when switching to backdrop mode
  useEffect(() => {
    if (!open || !useFrame || !getStageFrame) return;
    const url = getStageFrame();
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      frameImg.current = img;
      draw();
    };
    img.src = url;
  }, [open, useFrame]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = W;
    canvas.height = H;
    const t = activeTheme;

    const backdrop = useFrame ? frameImg.current : null;
    if (backdrop) {
      // cover-fit the captured frame
      const s = Math.max(W / backdrop.width, H / backdrop.height);
      const dw = backdrop.width * s;
      const dh = backdrop.height * s;
      ctx.drawImage(backdrop, (W - dw) / 2, (H - dh) / 2, dw, dh);
      // cinematic scrim for readable text
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, "rgba(0,0,0,0.12)");
      g.addColorStop(0.55, "rgba(0,0,0,0.30)");
      g.addColorStop(1, "rgba(0,0,0,0.68)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      drawTitle(ctx, title, subtitle, "#fff7ed", "#fbbf24");
      drawBadge(ctx);
      return;
    }

    // ---- designed card background ----
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, t.sky[0]);
    g.addColorStop(1, t.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // decorative motif
    if (t.deco === "sun") {
      ctx.fillStyle = "rgba(255, 237, 180, 0.65)";
      ctx.beginPath();
      ctx.arc(W * 0.8, H * 0.26, 130, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
      ctx.beginPath();
      ctx.arc(W * 0.8, H * 0.26, 92, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(180, 83, 9, 0.35)";
      ctx.fillRect(0, H * 0.8, W, H * 0.2);
    } else if (t.deco === "stars") {
      for (let i = 0; i < 42; i++) {
        const x = ((i * 197.3) % 1) * W;
        const y = ((i * 311.7) % 1) * H * 0.72;
        ctx.fillStyle = `rgba(226, 236, 255, ${0.35 + ((i * 7) % 5) / 10})`;
        ctx.beginPath();
        ctx.arc(x, y, 2.4, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "rgba(251, 191, 36, 0.9)";
      ctx.beginPath();
      ctx.arc(W * 0.85, H * 0.2, 58, 0, Math.PI * 2);
      ctx.fill();
    } else if (t.deco === "paddy") {
      ctx.strokeStyle = "rgba(238, 252, 200, 0.7)";
      ctx.lineWidth = 4;
      for (let i = 0; i < 26; i++) {
        const x = i * 52 + 10;
        const sway = Math.sin(i * 1.3) * 16;
        ctx.beginPath();
        ctx.moveTo(x, H);
        ctx.quadraticCurveTo(x + sway * 0.4, H - 70, x + sway, H - 120);
        ctx.stroke();
      }
    } else {
      // flags bunting
      const cols = ["#fbbf24", "#22d3ee", "#f472b6", "#a3e635"];
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 60);
      ctx.quadraticCurveTo(W / 2, 150, W, 60);
      ctx.stroke();
      for (let i = 0; i < 14; i++) {
        const q = (i + 0.5) / 14;
        const x = q * W;
        const y = 60 + Math.sin(q * Math.PI) * 88 * 0.9;
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath();
        ctx.moveTo(x - 18, y);
        ctx.lineTo(x + 18, y);
        ctx.lineTo(x, y + 36);
        ctx.closePath();
        ctx.fill();
      }
    }

    // film-strip border
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    for (let i = 0; i < 14; i++) {
      ctx.fillRect(18, 24 + i * 50, 26, 30);
      ctx.fillRect(W - 44, 24 + i * 50, 26, 30);
    }

    drawTitle(ctx, title, subtitle, t.text, t.accent, t.sub);
    drawBadge(ctx);
  }, [activeTheme, title, subtitle, useFrame]);

  /** shared title block — 3 sizes of Bangla display type */
  function drawTitle(
    ctx: CanvasRenderingContext2D,
    main: string,
    sub: string,
    color: string,
    accent: string,
    subColor?: string,
  ) {
    const text = main.trim() || "আমার কার্টুন";
    // main title — shrink to fit
    let size = 120;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (;;) {
      ctx.font = `800 ${size}px "Hind Siliguri", sans-serif`;
      if (ctx.measureText(text).width <= W * 0.84 || size <= 44) break;
      size -= 6;
    }
    const y = sub.trim() ? H * 0.52 : H * 0.5;

    // accent panel behind the main line
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.82;
    const th = size * 1.24;
    const tw = Math.min(W * 0.9, ctx.measureText(text).width + size * 0.7);
    ctx.beginPath();
    ctx.roundRect((W - tw) / 2, y - th / 2 - 10, tw, th + 20, 22);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.fillText(text, W / 2, y);

    if (sub.trim()) {
      ctx.font = `600 44px "Hind Siliguri", sans-serif`;
      ctx.fillStyle = subColor ?? color;
      ctx.fillText(sub.trim(), W / 2, y + size * 0.78 + 34);
    }
  }

  function drawBadge(ctx: CanvasRenderingContext2D) {
    ctx.font = "700 30px \"Hind Siliguri\", sans-serif";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const label = "🎬 ঠাট্টা স্টুডিও";
    const w = ctx.measureText(label).width + 40;
    ctx.fillStyle = "rgba(255, 251, 235, 0.92)";
    ctx.beginPath();
    ctx.roundRect(28, 26, w, 56, 28);
    ctx.fill();
    ctx.fillStyle = "#9a3412";
    ctx.fillText(label, 48, 55);
  }

  // redraw on any change / open
  useEffect(() => {
    if (!open) return;
    // small delay lets the dialog layout settle before measuring fonts
    const h = setTimeout(draw, 30);
    return () => clearTimeout(h);
  }, [open, draw]);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `thatta-thumbnail-${Date.now()}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-800">
            <Palette className="h-5 w-5 text-orange-600" /> থাম্বনেইল ডিজাইনার
          </DialogTitle>
          <DialogDescription>
            YouTube/Facebook-এর জন্য ঝকঝকে থাম্বনেইল — নাম লিখুন, থিম বাছুন,
            PNG ডাউনলোড করুন।
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
          <div className="overflow-hidden rounded-xl border border-amber-200">
            <canvas
              ref={canvasRef}
              className="block h-auto w-full"
              aria-label="থাম্বনেইল প্রিভিউ"
            />
          </div>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-amber-900">মেইন টাইটেল</Label>
                {online && (
                  <button
                    type="button"
                    onClick={fetchThumbIdeas}
                    disabled={loadingThumbIdeas}
                    className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-2 py-0.5 text-[11px] font-semibold text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-50"
                    title="AI ছোট ঝাঁঝালো টাইটেল বানিয়ে দেবে"
                  >
                    {loadingThumbIdeas ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    AI টাইটেল
                  </button>
                )}
              </div>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="কার্টুনের নাম"
                className="border-amber-300"
                maxLength={48}
              />
              {thumbIdeas && (
                <div className="thatta-scroll max-h-44 space-y-1.5 overflow-y-auto pr-1">
                  {thumbIdeas.map((it, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        setTitle(it.title);
                        setSubtitle(it.subtitle);
                      }}
                      className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-left transition-colors hover:border-orange-400 hover:bg-orange-50"
                    >
                      <span className="block truncate text-xs font-bold text-amber-950">
                        {it.title}
                      </span>
                      <span className="block truncate text-[11px] text-amber-600">
                        {it.subtitle}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-amber-900">সাব-টাইটেল</Label>
              <Input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="বাংলা কার্টুন"
                className="border-amber-300"
                maxLength={40}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-amber-900">থিম</Label>
              <div className="grid grid-cols-2 gap-1.5">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTheme(t.id)}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
                      theme === t.id
                        ? "border-orange-600 bg-orange-50 text-orange-800"
                        : "border-amber-200 bg-white text-amber-800 hover:bg-amber-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            {getStageFrame && (
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/60 px-3 py-2 text-xs font-semibold text-amber-900">
                <input
                  type="checkbox"
                  checked={useFrame}
                  onChange={(e) => setUseFrame(e.target.checked)}
                  className="accent-orange-600"
                />
                <ImageIcon className="h-4 w-4 text-amber-600" />
                স্টেজের ছবি ব্যাকড্রপ
              </label>
            )}
            <Button
              onClick={download}
              className="w-full bg-orange-600 text-white hover:bg-orange-700"
            >
              <Download className="mr-2 h-4 w-4" /> PNG ডাউনলোড
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
