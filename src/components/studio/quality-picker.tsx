'use client';

// ============================================================
// ঠাট্টা স্টুডিও — Phase 8: রেন্ডার মান নির্বাচক
// অটো / উচ্চ মান / ব্যাটারি সেভ — ৩টি মোডের ছোট segmented control.
// কম দামের ফোনে ব্যাটারি মোড নিলে সুপারস্যাম্পলিং কমে, পার্টিকেল
// অর্ধেক হয় — দৃশ্য একই থাকে, কিন্তু ফ্রেমরেট ও ব্যাটারি বাঁচে।
// ============================================================

import { useSyncExternalStore } from 'react';
import { Zap, Sparkles, GaugeCircle } from 'lucide-react';
import {
  getQualityMode,
  setQualityMode,
  subscribeQuality,
  resolveQuality,
  qualityLabel,
  type QualityMode,
} from '@/lib/render-quality';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const EMPTY_SNAPSHOT = (): QualityMode => "auto";

const MODES: { id: QualityMode; icon: typeof Zap; hint: string }[] = [
  { id: 'auto', icon: GaugeCircle, hint: 'ফোন দেখে নিজেই ঠিক করবে' },
  { id: 'high', icon: Sparkles, hint: 'সবচেয়ে ঝকঝকে ছবি (২× স্মুথ)' },
  { id: 'battery', icon: Zap, hint: 'কম ফোনে মসৃণ, ব্যাটারি বাঁচবে' },
];

export function QualityPicker() {
  const mode = useSyncExternalStore(
    subscribeQuality,
    getQualityMode,
    EMPTY_SNAPSHOT,
  );
  const resolved = resolveQuality();

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className="inline-flex items-center rounded-lg border border-amber-300 bg-amber-50/70 p-0.5"
        role="group"
        aria-label="রেন্ডার মান বাছাই"
      >
        {MODES.map(({ id, icon: Icon, hint }) => {
          const active = mode === id;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setQualityMode(id)}
                  aria-pressed={active}
                  aria-label={`রেন্ডার মান: ${qualityLabel(id)} — ${hint}`}
                  className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-amber-800 hover:bg-amber-100'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  <span className="hidden sm:inline">{qualityLabel(id)}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">
                <p className="font-semibold">{qualityLabel(id)}</p>
                <p>
                  {hint}
                  {id === 'auto' && (
                    <span className="block text-amber-600">
                      (এই ফোনে: {resolved === 'high' ? 'উচ্চ মান' : 'ব্যাটারি সেভ'})
                    </span>
                  )}
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
