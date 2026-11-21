"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 7: কমিউনিটি গ্যালারি ট্যাব
//
// সবার পাবলিশ করা কার্টুন দেখা + লাইক + জনপ্রিয় তালিকা + এক ক্লিকে
// স্টুডিওতে খোলা (episode import)। Offline হলে ব্যাখ্যা দেখায় —
// স্টুডিও অবশ্য অফলাইনেও পুরো চলে।
// ============================================================

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useSyncExternalStore } from "react";
import { toast } from "@/hooks/use-toast";
import { useStudio } from "@/lib/store";
import { makeDesign, normalizeEpisodes, presetCast, starterScene } from "@/lib/cartoon/presets";
import type { CharacterDesign, EpisodeScene } from "@/lib/cartoon/types";
import {
  Clapperboard,
  Flame,
  Heart,
  RefreshCw,
  Search,
  Sparkles,
  WifiOff,
  X,
} from "lucide-react";

const bnNum = (n: number | string) =>
  String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

/** subscribe to online/offline as an external store */
const emptySubscribe = () => () => {};
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

interface GalleryMeta {
  id: string;
  name: string;
  author: string;
  thumbnail: string | null;
  duration: number;
  likes: number;
  createdAt: string;
}

const LIKED_KEY = "thatta.likes";

function readLiked(): Set<string> {
  try {
    const arr = JSON.parse(localStorage.getItem(LIKED_KEY) ?? "[]") as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export default function GalleryTab({
  onOpenInStudio,
}: {
  onOpenInStudio: () => void;
}) {
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  const [items, setItems] = useState<GalleryMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [sort, setSort] = useState<"recent" | "popular">("recent");
  const [q, setQ] = useState("");
  const [authorFilter, setAuthorFilter] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [likeBusy, setLikeBusy] = useState<string | null>(null);

  useEffect(() => setLiked(readLiked()), []);

  const fetchList = useCallback(async () => {
    if (!navigator.onLine) {
      setLoadError(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(false);
    try {
      const sp = new URLSearchParams({ sort, limit: "60" });
      if (authorFilter) sp.set("author", authorFilter);
      if (q.trim()) sp.set("q", q.trim());
      const res = await fetch(`/api/gallery?${sp.toString()}`);
      if (!res.ok) throw new Error("list failed");
      const body = (await res.json()) as { items: GalleryMeta[] };
      setItems(Array.isArray(body.items) ? body.items : []);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [sort, q, authorFilter]);

  // debounced fetch on filter changes
  useEffect(() => {
    const h = setTimeout(() => void fetchList(), q ? 350 : 0);
    return () => clearTimeout(h);
  }, [fetchList, q]);

  const openInStudio = async (item: GalleryMeta) => {
    setOpeningId(item.id);
    try {
      const res = await fetch(`/api/gallery/${item.id}`);
      if (!res.ok) throw new Error("load failed");
      const body = (await res.json()) as {
        item: { data: string } & GalleryMeta;
      };
      const parsed = JSON.parse(body.item.data) as {
        designs?: unknown;
        scenes?: unknown;
        activeSceneId?: unknown;
      };
      const designs: CharacterDesign[] = Array.isArray(parsed.designs)
        ? parsed.designs
            .filter((d): d is Partial<CharacterDesign> => !!d && typeof d === "object")
            .map((d) => makeDesign(d))
        : presetCast();
      const scenes = normalizeEpisodes(parsed.scenes, () =>
        starterScene(presetCast()),
      );
      if (scenes.length === 0) throw new Error("empty");
      const activeSceneId =
        typeof parsed.activeSceneId === "string" &&
        scenes.some((es) => es.id === parsed.activeSceneId)
          ? parsed.activeSceneId
          : scenes[0].id;
      useStudio.getState().loadEpisodes(
        scenes as EpisodeScene[],
        designs,
        activeSceneId,
      );
      toast({
        title: "স্টুডিওতে খোলা হয়েছে 🎬",
        description: `"${item.name}" — ${bnNum(scenes.length)}টি দৃশ্য লোড হয়েছে। এখন প্লে করে দেখুন!`,
      });
      onOpenInStudio();
    } catch {
      toast({
        title: "খোলা যায়নি",
        description: "আরেকবার চেষ্টা করুন — সমস্যা হলে পরে আবার করুন।",
        variant: "destructive",
      });
    } finally {
      setOpeningId(null);
    }
  };

  const like = async (item: GalleryMeta) => {
    if (liked.has(item.id) || likeBusy === item.id || !navigator.onLine) return;
    setLikeBusy(item.id);
    try {
      const res = await fetch(`/api/gallery/${item.id}/like`, { method: "POST" });
      if (!res.ok) throw new Error("like failed");
      const body = (await res.json()) as { item: { id: string; likes: number } };
      const next = new Set(liked).add(item.id);
      setLiked(next);
      localStorage.setItem(LIKED_KEY, JSON.stringify([...next]));
      setItems((prev) =>
        prev.map((it) => (it.id === item.id ? { ...it, likes: body.item.likes } : it)),
      );
    } catch {
      toast({ title: "লাইক করা যায়নি", variant: "destructive" });
    } finally {
      setLikeBusy(null);
    }
  };

  const heading = useMemo(
    () => (sort === "popular" ? "জনপ্রিয় কার্টুন 🔥" : "নতুন পাবলিশ 🆕"),
    [sort],
  );

  return (
    <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      {/* header row */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-orange-800">
            <Sparkles className="mr-1.5 inline h-5 w-5 text-amber-500" />
            কমিউনিটি গ্যালারি
          </h2>
          <p className="text-sm text-amber-700">
            সবার বানানো কার্টুন দেখুন, লাইক দিন — অথবা নিজের এপিসোড স্টুডিও থেকে
            পাবলিশ করুন।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={sort === "recent" ? "default" : "outline"}
            onClick={() => setSort("recent")}
            className={
              sort === "recent"
                ? "bg-orange-600 text-white hover:bg-orange-700"
                : "border-amber-300"
            }
          >
            <Clapperboard className="mr-1.5 h-4 w-4" /> নতুন
          </Button>
          <Button
            size="sm"
            variant={sort === "popular" ? "default" : "outline"}
            onClick={() => setSort("popular")}
            className={
              sort === "popular"
                ? "bg-orange-600 text-white hover:bg-orange-700"
                : "border-amber-300"
            }
          >
            <Flame className="mr-1.5 h-4 w-4" /> জনপ্রিয়
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300"
            onClick={() => void fetchList()}
            aria-label="রিফ্রেশ"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* search + author filter */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="নাম বা লেখক দিয়ে খুঁজুন..."
            className="border-amber-300 pl-9"
            aria-label="গ্যালারি সার্চ"
          />
        </div>
        {authorFilter && (
          <Button
            size="sm"
            variant="outline"
            className="border-orange-300 text-orange-700"
            onClick={() => setAuthorFilter(null)}
          >
            লেখক: {authorFilter} <X className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
        <span className="ml-auto text-xs text-amber-600">
          {online ? "" : "অফলাইন — তালিকা আপডেট হবে না"}
        </span>
      </div>

      {/* body */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-64 animate-pulse rounded-2xl border border-amber-200 bg-amber-100/60"
            />
          ))}
        </div>
      ) : loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700">
          গ্যালারি লোড করা যায়নি — ইন্টারনেট সংযোগ দেখে রিফ্রেশ চাপুন।
          <div className="mt-3">
            <Button
              size="sm"
              onClick={() => void fetchList()}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              <RefreshCw className="mr-1.5 h-4 w-4" /> আবার চেষ্টা
            </Button>
          </div>
        </div>
      ) : !online && items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-amber-300 bg-amber-50 p-8 text-center text-amber-800">
          <WifiOff className="h-8 w-8" />
          <p className="font-semibold">অফলাইন মোড</p>
          <p className="text-sm">
            গ্যালারি দেখতে ইন্টারনেট লাগে, তবে স্টুডিও সম্পূর্ণ অফলাইনে চলে।
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/70 p-8 text-center">
          <p className="text-lg font-bold text-amber-900">
            {heading} — এখনো কিছু নেই!
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-amber-700">
            প্রথম পাবলিশটি আপনিই করতে পারেন — স্টুডিওতে একটি কার্টুন বানিয়ে
            &quot;সেভ/শেয়ার&quot; মেনু থেকে গ্যালারিতে পাবলিশ করুন।
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((it) => (
            <Card key={it.id} className="overflow-hidden border-amber-200">
              <div className="relative aspect-video w-full bg-amber-100">
                {it.thumbnail ? (
                  <img
                    src={it.thumbnail}
                    alt={`${it.name} — থাম্বনেইল`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-amber-100 to-orange-200 text-5xl">
                    🎬
                  </div>
                )}
                <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-semibold text-white">
                  ⏱ {bnNum(it.duration.toFixed(1))} সে.
                </span>
              </div>
              <CardContent className="space-y-2 p-4">
                <div>
                  <p className="truncate text-sm font-bold text-amber-950" title={it.name}>
                    {it.name}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAuthorFilter(it.author)}
                    className="max-w-full truncate text-xs text-amber-700 hover:text-orange-700 hover:underline"
                    title="এই লেখকের সব কার্টুন দেখুন"
                  >
                    ✍️ {it.author}
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <Button
                    size="sm"
                    onClick={() => void openInStudio(it)}
                    disabled={openingId === it.id}
                    className="bg-orange-600 text-white hover:bg-orange-700"
                  >
                    {openingId === it.id ? "খুলছে..." : "স্টুডিওতে খুলুন"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className={
                      liked.has(it.id)
                        ? "border-rose-300 bg-rose-50 text-rose-600"
                        : "border-amber-300 text-amber-800"
                    }
                    onClick={() => void like(it)}
                    disabled={liked.has(it.id) || likeBusy === it.id}
                    aria-label={`${it.name} লাইক করুন`}
                  >
                    <Heart
                      className={`h-4 w-4 ${liked.has(it.id) ? "fill-rose-500 text-rose-500" : ""}`}
                    />
                    <span className="ml-1 text-xs font-semibold">
                      {bnNum(it.likes)}
                    </span>
                  </Button>
                </div>
                <p className="text-[11px] text-amber-500">
                  {new Date(it.createdAt).toLocaleDateString("bn-BD", {
                    day: "numeric",
                    month: "long",
                  })}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-6 border-amber-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-orange-800">
            নিজের কার্টুন পাবলিশ করবেন কীভাবে?
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-amber-700">
          <ol className="list-decimal space-y-1 pl-5">
            <li>স্টুডিও ট্যাবে এপিসোড বানান (একাধিক দৃশ্য হলে আরও মজা!)</li>
            <li>টুলবারে &quot;সেভ&quot; বোতামের পাশে &quot;গ্যালারিতে পাবলিশ&quot; চাপুন</li>
            <li>নাম-লেখক লিখে পাবলিশ — সাথে সাথে এখানে চলে আসবে</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
