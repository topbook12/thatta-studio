"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 9: AI সহকারী (client helpers)
//
// • useIsOnline() — live online/offline state (AI features are
//   simply HIDDEN offline, per the roadmap's graceful degradation)
// • aiPost<T>() — typed fetch for the /api/ai/* routes with
//   Bangla error messages surfaced straight to toasts
// ============================================================

import { useEffect, useState } from "react";

export function useIsOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

/** One AI call — returns data or throws an Error with a Bangla message. */
export async function aiPost<T>(url: string, body: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("নেটওয়ার্কে পৌঁছানো যাচ্ছে না — ইন্টারনেট দেখে আবার চেষ্টা করুন");
  }

  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(
      typeof data.error === "string" && data.error
        ? data.error
        : `AI সার্ভিস ব্যস্ত (${res.status}) — একটু পরে চেষ্টা করুন`,
    );
  }
  return data as T;
}
