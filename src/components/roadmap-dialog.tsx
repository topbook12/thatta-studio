"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, CircleDashed, Map, LoaderCircle } from "lucide-react";
import { ROADMAP, ROADMAP_RITUALS } from "@/lib/roadmap";

const bnNum = (n: number | string) => String(n).replace(/\d/g, (d) => "০১২৩৪৫৬৭৮৯"[+d]);

/** progress = done items / total items across the whole roadmap */
function useRoadmapProgress() {
  const total = ROADMAP.reduce((n, p) => n + p.items.length, 0);
  const done = ROADMAP.reduce(
    (n, p) => n + p.items.filter((i) => i.done).length,
    0,
  );
  return { total, done, pct: Math.round((done / Math.max(1, total)) * 100) };
}

export default function RoadmapDialog() {
  const [open, setOpen] = useState(false);
  const { total, done, pct } = useRoadmapProgress();

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5 rounded-full border-amber-300 bg-white/70 px-3 text-xs font-semibold text-orange-800 hover:bg-amber-100"
        aria-label="১০০ দিনের রোডম্যাপ দেখুন"
      >
        <Map className="h-3.5 w-3.5 text-amber-600" />
        <span className="hidden sm:inline">রোডম্যাপ</span>
        <span className="rounded-full bg-amber-100 px-1.5 text-[10px] text-amber-800">
          {bnNum(done)}/{bnNum(total)}
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl rounded-2xl border-amber-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-900">
              <Map className="h-5 w-5 text-amber-600" />
              ১০০ দিনের ফুল-প্ল্যাটফর্ম রোডম্যাপ
            </DialogTitle>
            <DialogDescription>
              ১০টি ফেজে প্ল্যাটফর্মটি হবে আরও সহজ, আরও শক্তিশালী — বিস্তারিত প্ল্যান:{" "}
              <code className="rounded bg-amber-100 px-1 text-[11px]">docs/plan-100-din.md</code>
            </DialogDescription>
          </DialogHeader>

          <div className="thatta-scroll max-h-[62vh] space-y-3 overflow-y-auto pr-2">
            {ROADMAP.map((phase) => (
              <section
                key={phase.id}
                className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5"
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-bold text-orange-900">
                    {phase.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className="border-amber-300 bg-white text-[10px] font-semibold text-amber-800"
                  >
                    {phase.days}
                  </Badge>
                  {phase.status === "active" && (
                    <Badge className="gap-1 bg-orange-600 text-[10px] text-white">
                      <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden /> চলছে
                    </Badge>
                  )}
                  {phase.status === "planned" && (
                    <Badge
                      variant="outline"
                      className="border-dashed border-amber-300 text-[10px] text-amber-700"
                    >
                      আসছে
                    </Badge>
                  )}
                </div>
                <p className="mb-2 text-xs text-amber-700">{phase.focus}</p>
                <ul className="grid gap-1.5">
                  {phase.items.map((item) => (
                    <li key={item.text} className="flex items-start gap-2 text-sm">
                      {item.done ? (
                        <CheckCircle2
                          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                          aria-label="সম্পন্ন"
                        />
                      ) : (
                        <CircleDashed
                          className="mt-0.5 h-4 w-4 shrink-0 text-amber-400"
                          aria-label="পরিকল্পিত"
                        />
                      )}
                      <span
                        className={
                          item.done
                            ? "text-amber-900"
                            : "text-amber-800/70"
                        }
                      >
                        {item.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}

            <section className="rounded-xl border border-teal-200 bg-teal-50/60 p-3.5">
              <h3 className="mb-2 text-sm font-bold text-teal-900">
                সাপ্তাহিক অভ্যাস (কোয়ালিটি রক্ষার নিয়ম)
              </h3>
              <ul className="grid gap-1.5">
                {ROADMAP_RITUALS.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-sm text-teal-900">
                    <span aria-hidden>•</span>
                    {r}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <p className="text-xs font-medium text-amber-700">
            অগ্রগতি: {bnNum(done)}/{bnNum(total)} কাজ সম্পন্ন ({bnNum(pct)}%) —
            মনিটাইজেশন ছাড়াই, সম্পূর্ণ ফ্রি।
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
