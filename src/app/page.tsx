"use client";

import { useState, useSyncExternalStore } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StudioTab from "@/components/tabs/studio-tab";
import CreatorTab from "@/components/tabs/creator-tab";
import CoursesTab from "@/components/tabs/courses-tab";
import RoadmapDialog from "@/components/roadmap-dialog";
import { Clapperboard, GraduationCap, Sparkles, UserRound, WifiOff } from "lucide-react";

const emptySubscribe = () => () => {};

/** live online/offline status as an external store (Sprint 7) */
function subscribeOnline(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export default function Home() {
  const [tab, setTab] = useState("studio");
  // Sprint 7 — live offline indicator (PWA keeps working without network)
  const online = useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true,
  );
  // The studio store seeds itself with random UUIDs (module level) and
  // rehydrates from localStorage — render tab content only after mount so
  // server HTML never conflicts with client state (no hydration mismatch).
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );

  return (
    <div className="min-h-screen flex flex-col bg-amber-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50/95 backdrop-blur supports-[backdrop-filter]:bg-amber-50/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-3 py-2.5 sm:px-6 sm:py-3">
          <div className="flex items-center gap-2.5 sm:gap-3">
            <img
              src="/icons/icon-192.png"
              alt="ঠাট্টা স্টুডিও লোগো"
              className="h-10 w-10 rounded-xl border border-amber-200 shadow-sm sm:h-12 sm:w-12"
            />
            <div className="leading-tight">
              <h1 className="text-lg font-bold text-orange-800 sm:text-xl">
                ঠাট্টা স্টুডিও
              </h1>
              <p className="hidden text-xs text-amber-700 sm:block">
                বাংলা কার্টুন বানানোর সহজ প্ল্যাটফর্ম
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <RoadmapDialog />
            <div className="hidden items-center gap-1.5 rounded-full border border-amber-300 bg-white/70 px-3 py-1.5 text-xs font-medium text-orange-700 md:flex">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              ফ্রি • ইনস্টলযোগ্য অ্যাপ • অফলাইনেও চলে
            </div>
          </div>
          {!online && (
            <div className="flex items-center gap-1.5 rounded-full border border-orange-300 bg-orange-100 px-3 py-1.5 text-xs font-semibold text-orange-800">
              <WifiOff className="h-3.5 w-3.5" />
              অফলাইন মোড — সব কাজ ডিভাইসেই হচ্ছে
            </div>
          )}
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto w-full max-w-7xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 rounded-2xl border border-amber-200 bg-white/80 p-1.5 sm:w-auto sm:inline-grid">
            <TabsTrigger
              value="studio"
              className="gap-1.5 rounded-xl py-2.5 text-sm font-semibold data-[state=active]:bg-orange-600 data-[state=active]:text-white sm:px-6"
            >
              <Clapperboard className="h-4 w-4" />
              স্টুডিও
            </TabsTrigger>
            <TabsTrigger
              value="creator"
              className="gap-1.5 rounded-xl py-2.5 text-sm font-semibold data-[state=active]:bg-orange-600 data-[state=active]:text-white sm:px-6"
            >
              <UserRound className="h-4 w-4" />
              ক্যারেক্টার তৈরি
            </TabsTrigger>
            <TabsTrigger
              value="courses"
              className="gap-1.5 rounded-xl py-2.5 text-sm font-semibold data-[state=active]:bg-orange-600 data-[state=active]:text-white sm:px-6"
            >
              <GraduationCap className="h-4 w-4" />
              কোর্স
            </TabsTrigger>
          </TabsList>

          <TabsContent value="studio" className="mt-0 focus-visible:outline-none">
            {mounted ? (
              <StudioTab onOpenCreator={() => setTab("creator")} />
            ) : (
              <div className="flex h-64 items-center justify-center rounded-2xl border border-amber-200 bg-white/60 text-sm font-medium text-amber-700">
                স্টুডিও লোড হচ্ছে...
              </div>
            )}
          </TabsContent>
          <TabsContent value="creator" className="mt-0 focus-visible:outline-none">
            {mounted ? <CreatorTab /> : null}
          </TabsContent>
          <TabsContent value="courses" className="mt-0 focus-visible:outline-none">
            {mounted ? <CoursesTab onOpenStudio={() => setTab("studio")} /> : null}
          </TabsContent>
        </Tabs>
      </main>

      {/* Sticky footer */}
      <footer className="mt-auto border-t border-amber-200 bg-amber-100/60">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-1.5 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-xs text-amber-800 sm:flex-row sm:text-left">
          <p className="font-semibold">
            🎬 ঠাট্টা স্টুডিও — বানান মজার কার্টুন, জিতে নিন লাখো হাসি!
          </p>
          <p>বাংলা ক্রিয়েটরদের জন্য তৈরি • Progressive Web App</p>
        </div>
      </footer>
    </div>
  );
}
