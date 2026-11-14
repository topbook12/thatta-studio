"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Error boundary with crash recovery
// (Phase 1, Day 1–10)
//
// If a render error ever crashes the studio, the user sees a
// friendly Bangla screen with three safe exits:
//   1. reload (try again)
//   2. restore the newest auto-backup into the store + reload
//   3. wipe studio storage and start fresh
// ============================================================

import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  clearAutosave,
  readLatestAutosave,
  restoreAutosaveIntoStore,
} from "@/lib/autosave";

interface State {
  error: Error | null;
  hasBackup: boolean;
}

const STORE_KEY = "thatta-studio-v1";

export default class StudioErrorBoundary extends Component<
  { children: ReactNode },
  State
> {
  state: State = { error: null, hasBackup: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // keep the trace for debugging — visible in dev.log / devtools
    console.error("স্টুডিও ক্র্যাশ:", error, info?.componentStack);
    this.setState({ hasBackup: !!readLatestAutosave() });
  }

  private reload = () => window.location.reload();

  private restoreBackup = () => {
    if (restoreAutosaveIntoStore()) {
      window.location.reload();
    } else {
      this.reload();
    }
  };

  private startFresh = () => {
    try {
      localStorage.removeItem(STORE_KEY);
      clearAutosave();
    } catch {
      /* ignore */
    }
    window.location.reload();
  };

  render() {
    const { error, hasBackup } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-[420px] items-center justify-center p-4">
        <div className="w-full max-w-lg space-y-4 rounded-2xl border-2 border-rose-200 bg-white p-6 text-center shadow-lg">
          <div className="text-4xl">🛠️</div>
          <h2 className="text-xl font-extrabold text-amber-950">
            উফ! স্টুডিওতে একটা সমস্যা হয়েছে
          </h2>
          <p className="text-sm leading-relaxed text-amber-800">
            চিন্তা নেই — আপনার কাজ প্রতি ৩ সেকেন্ডে ডিভাইসে ব্যাকআপ হয়।
            নিচের বাটন দিয়ে ফিরে আসুন।
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Button
              onClick={this.reload}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              🔄 আবার চেষ্টা করুন
            </Button>
            {hasBackup && (
              <Button
                onClick={this.restoreBackup}
                variant="outline"
                className="border-emerald-300 text-emerald-800 hover:bg-emerald-50"
              >
                💾 ব্যাকআপ রিস্টোর করুন
              </Button>
            )}
            <Button
              onClick={this.startFresh}
              variant="outline"
              className="border-rose-300 text-rose-700 hover:bg-rose-50"
            >
              🗑️ নতুন করে শুরু করুন
            </Button>
          </div>
          <p className="break-words rounded-lg bg-amber-50 px-3 py-2 text-left text-xs text-amber-700">
            {error.message || "অজানা ত্রুটি"}
          </p>
        </div>
      </div>
    );
  }
}
