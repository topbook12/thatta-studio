'use client';

// ============================================================
// ঠাট্টা স্টুডিও — Phase 8: অফলাইন স্টোরেজ ম্যানেজার
// ডিভাইসে কত জায়গা ব্যবহৃত হচ্ছে (কোটা মিটার), প্রতিটি প্রজেক্টের
// সাইজ, এক ট্যাপে প্রজেক্ট ডিলিট ও পুরনোগুলো পরিষ্কার + ভয়েস ক্যাশ
// মোছার বাটন — সব অফলাইনে কাজ করে।
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Database, HardDrive, Mic2, Trash2, Eraser } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  listLocalProjects,
  deleteLocalProject,
  type LocalProjectMeta,
} from '@/lib/local-projects';
import {
  voiceStoreUsage,
  clearVoiceStore,
} from '@/lib/audio-store';

function bn(n: number): string {
  return n.toLocaleString('bn-BD');
}

function fmtBytes(b: number): string {
  if (b >= 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} মেবাইট`;
  if (b >= 1024) return `${Math.round(b / 1024)} কেবি`;
  return `${bn(b)} বাইট`;
}

function fmtWhen(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

interface Usage {
  usage: number;
  quota: number;
}

export function StorageManager({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [projects, setProjects] = useState<LocalProjectMeta[]>([]);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [voices, setVoices] = useState<{ bytes: number; count: number } | null>(
    null,
  );
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(() => {
    setProjects(listLocalProjects());
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then((e) =>
          setUsage({ usage: e.usage ?? 0, quota: e.quota ?? 0 }),
        )
        .catch(() => setUsage(null));
    } else {
      setUsage(null);
    }
    void voiceStoreUsage().then(setVoices);
  }, []);

  useEffect(() => {
    if (!open) return;
    // defer one tick — storage APIs are async anyway and this keeps the
    // effect body free of direct setState calls
    const id = window.setTimeout(refresh, 0);
    return () => window.clearTimeout(id);
  }, [open, refresh]);

  const removeProject = (p: LocalProjectMeta) => {
    deleteLocalProject(p.id);
    toast.success(`"${p.name}" ডিলিট হয়েছে`);
    refresh();
  };

  /** one tap: keep the 5 newest projects, delete the rest */
  const cleanupOld = () => {
    const victims = projects.slice(5);
    if (victims.length === 0) {
      toast.info('পরিষ্কার করার মতো পুরনো প্রজেক্ট নেই — সব ঠিক আছে!');
      return;
    }
    for (const p of victims) deleteLocalProject(p.id);
    toast.success(
      `${bn(victims.length)}টি পুরনো প্রজেক্ট মুছে ফেলা হয়েছে — সর্বশেষ ৫টি রাখা হয়েছে`,
    );
    refresh();
  };

  const wipeVoices = async () => {
    setBusy(true);
    const ok = await clearVoiceStore();
    setBusy(false);
    if (ok) {
      toast.success('ভয়েস ক্যাশ খালি — পরের ভয়েস আবার তৈরি হবে');
    } else {
      toast.error('ভয়েস ক্যাশ মোছা যায়নি');
    }
    refresh();
  };

  const projectsBytes = projects.reduce((s, p) => s + p.size, 0);
  const pct =
    usage && usage.quota > 0
      ? Math.min(100, Math.round((usage.usage / usage.quota) * 100))
      : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-orange-800">
            <Database className="h-5 w-5" aria-hidden /> অফলাইন স্টোরেজ
            ম্যানেজার
          </DialogTitle>
          <DialogDescription>
            এই ফোনে কী কত জায়গা নিচ্ছে দেখুন — দরকার হলে এক ট্যাপে পরিষ্কার
            করুন। অ্যাপ ইন্টারনেট ছাড়াই কাজ করে তাই ডিলিট করা প্রজেক্ট আর
            ফেরত আসবে না।
          </DialogDescription>
        </DialogHeader>

        {/* quota meter */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="mb-2 flex items-center justify-between text-sm font-semibold text-amber-900">
            <span className="inline-flex items-center gap-1.5">
              <HardDrive className="h-4 w-4" aria-hidden /> ব্রাউজারের জায়গা
            </span>
            <span>
              {usage
                ? `${fmtBytes(usage.usage)} / ${
                    usage.quota > 0 ? fmtBytes(usage.quota) : '?'
                  }`
                : 'মাপা যায়নি'}
            </span>
          </div>
          {pct != null && (
            <>
              <Progress value={pct} className="h-2.5" aria-label={`ব্যবহৃত ${pct}%`} />
              <p className="mt-1.5 text-xs text-amber-700">
                {bn(pct)}% ব্যবহৃত — {pct > 80
                  ? 'জায়গা প্রায় ভরে গেছে, পরিষ্কার করুন!'
                  : 'এখনো নিরাপদ'}
              </p>
            </>
          )}
        </div>

        {/* voice cache */}
        <div className="flex items-center justify-between rounded-xl border border-amber-200 p-3">
          <div className="flex items-center gap-2 text-sm">
            <Mic2 className="h-4 w-4 text-amber-700" aria-hidden />
            <div>
              <p className="font-semibold text-amber-900">ভয়েস ক্যাশ (অফলাইন কথা)</p>
              <p className="text-xs text-amber-700">
                {voices
                  ? `${bn(voices.count)} লাইন — ${fmtBytes(voices.bytes)}`
                  : 'মাপা হচ্ছে…'}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={wipeVoices}
            disabled={busy || !voices || voices.count === 0}
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            <Eraser className="mr-1 h-3.5 w-3.5" aria-hidden /> খালি করুন
          </Button>
        </div>

        {/* device projects */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-amber-900">
              ডিভাইসে সেভ করা প্রজেক্ট ({bn(projects.length)}টি —{' '}
              {fmtBytes(projectsBytes)})
            </p>
            {projects.length > 5 && (
              <Button
                size="sm"
                variant="outline"
                onClick={cleanupOld}
                className="border-amber-300 text-amber-800 hover:bg-amber-100"
              >
                পুরনোগুলো মুছুন
              </Button>
            )}
          </div>
          {projects.length === 0 ? (
            <p className="rounded-lg border border-dashed border-amber-300 p-4 text-center text-sm text-amber-700">
              এখনো কোনো প্রজেক্ট ডিভাইসে সেভ করা হয়নি — "সেভ" বাটন দিয়ে শুরু
              করুন।
            </p>
          ) : (
            <ul className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 p-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-amber-900">
                      {p.name}
                    </p>
                    <p className="text-xs text-amber-700">
                      {fmtBytes(p.size)} • {fmtWhen(p.updatedAt)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`${p.name} ডিলিট করুন`}
                    onClick={() => removeProject(p)}
                    className="shrink-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
