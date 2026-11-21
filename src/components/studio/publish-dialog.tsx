"use client";

// ============================================================
// ঠাট্টা স্টুডিও — Phase 7: গ্যালারিতে পাবলিশ dialog
// Collects a display name + creator name, grabs the serialized
// project + a stage thumbnail from the studio, and POSTs it to
// /api/gallery. Gracefully explains when offline.
// ============================================================

import { useEffect, useState } from "react";
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
import { CloudUpload, WifiOff } from "lucide-react";

export interface GalleryPayload {
  data: string;
  thumbnail: string | null;
  duration: number;
}

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  /** serialize the current project + capture a stage frame */
  collectPayload: () => GalleryPayload | null;
  onPublished?: () => void;
}

const AUTHOR_KEY = "thatta.author-name";

export default function PublishDialog({
  open,
  onOpenChange,
  collectPayload,
  onPublished,
}: PublishDialogProps) {
  const [name, setName] = useState("");
  const [author, setAuthor] = useState("");
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAuthor(localStorage.getItem(AUTHOR_KEY) ?? "");
    setOffline(typeof navigator !== "undefined" && !navigator.onLine);
  }, [open]);

  const submit = async () => {
    if (busy) return;
    const n = name.trim();
    const a = author.trim();
    if (!n) {
      toast({ title: "নাম দিন", description: "কার্টুনটির একটি নাম দিন।", variant: "destructive" });
      return;
    }
    if (!a) {
      toast({
        title: "লেখকের নাম দিন",
        description: "গ্যালারিতে কে বানিয়েছে সেটা দেখানোর জন্য নিজের নাম লিখুন।",
        variant: "destructive",
      });
      return;
    }
    const payload = collectPayload();
    if (!payload) {
      toast({
        title: "প্রজেক্ট খালি",
        description: "পাবলিশ করার মতো কিছু নেই — আগে দৃশ্য বানান।",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      localStorage.setItem(AUTHOR_KEY, a);
      const res = await fetch("/api/gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, author: a, ...payload }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? "পাবলিশ করা যায়নি");
      toast({
        title: "গ্যালারিতে পাবলিশ হয়েছে! 🎉",
        description: `"${n}" এখন সবাই দেখতে পাবে — গ্যালারি ট্যাবে যান।`,
      });
      onOpenChange(false);
      setName("");
      onPublished?.();
    } catch (e) {
      toast({
        title: "পাবলিশ হয়নি",
        description:
          e instanceof Error ? e.message : "ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-800">
            <CloudUpload className="h-5 w-5 text-orange-600" /> গ্যালারিতে পাবলিশ করুন
          </DialogTitle>
          <DialogDescription>
            আপনার সম্পূর্ণ এপিসোড কমিউনিটি গ্যালারিতে যাবে — সবাই দেখতে ও স্টুডিওতে
            খুলতে পারবে, আর লাইক দিতে পারবে।
          </DialogDescription>
        </DialogHeader>

        {offline ? (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
            <WifiOff className="h-4 w-4 shrink-0" />
            অফলাইন মোড — গ্যালারিতে পাবলিশ করতে ইন্টারনেট লাগবে। কাজ ডিভাইসেই সেভ থাকবে।
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pub-name" className="text-xs font-semibold text-amber-900">
                কার্টুনের নাম
              </Label>
              <Input
                id="pub-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="যেমন: গোপাল ভাঁড় ও মিথ্যে সাক্ষী"
                className="border-amber-300"
                maxLength={80}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pub-author" className="text-xs font-semibold text-amber-900">
                আপনার নাম (লেখক)
              </Label>
              <Input
                id="pub-author"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="যেমন: রাজু"
                className="border-amber-300"
                maxLength={80}
              />
            </div>
            <p className="text-xs text-amber-600">
              পাবলিশ করলে সংলাপ ও দৃশ্য প্রকাশ্য হবে — ব্যক্তিগত তথ্য রাখবেন না।
            </p>
            <Button
              onClick={submit}
              disabled={busy}
              className="w-full bg-orange-600 text-white hover:bg-orange-700"
            >
              {busy ? "পাবলিশ হচ্ছে..." : "🎉 পাবলিশ করুন"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
