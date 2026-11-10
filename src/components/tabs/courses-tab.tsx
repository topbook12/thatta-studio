'use client';

import { useEffect, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CheckCircle2,
  Clapperboard,
  Download,
  GraduationCap,
  Image as ImageIcon,
  Lightbulb,
  Mic,
  Palette,
  Sparkles,
} from 'lucide-react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const STORAGE_KEY = 'thatta-course-progress';

/** ইংরেজি সংখ্যা → বাংলা সংখ্যা */
function toBangla(value: number | string): string {
  return String(value).replace(/\d/g, (d) => '০১২৩৪৫৬৭৮৯'[Number(d)]);
}

type LessonAccent = {
  badge: string;
  iconText: string;
  step: string;
  tip: string;
  tipTitle: string;
};

type Lesson = {
  id: string;
  number: number;
  emoji: string;
  icon: LucideIcon;
  tag: string;
  title: string;
  intro: string;
  steps: string[];
  tips: string[];
  accent: LessonAccent;
};

const LESSONS: Lesson[] = [
  {
    id: 'lesson-1',
    number: 1,
    emoji: '📝',
    icon: BookOpen,
    tag: 'গল্প',
    title: 'পাঠ ১: মজার গল্প লেখা',
    intro:
      'প্রতিটা ভাইরাল কার্টুনের শুরু হয় একটা মজার গল্প দিয়ে। ১–৩ মিনিটের কার্টুনের জন্য ছোট কিন্তু দারুণ একটা গল্প লিখুন — পরিচয়, ঝামেলা আর মজার মোড় — এই তিনটা জিনিস থাকলেই দর্শক শেষ পর্যন্ত দেখবে।',
    steps: [
      'একটা খাতায় বা মোবাইলের নোটে গল্পের পরিচয় (setup) লিখুন — কে, কোথায়, কী করছে? মাত্র ১–২ লাইনে শেষ করুন।',
      'তারপর ঝামেলা (conflict) লিখুন — গোপাল কী বিপদে পড়ল, বা পাড়ায় কী অদ্ভুত ঘটনা ঘটল?',
      'শেষে মজার মোড় (punchline) লিখুন — যেটা শুনে দর্শক হেসে গড়গড় করবে।',
      'সব ডায়ালগ ছোট রাখুন — এক লাইনের বেশি কথা কোনো ক্যারেক্টার বলবে না।',
      'মনে রাখুন: ৩-টি দৃশ্য = একটি ভাইরাল কার্টুন। বেশি দৃশ্য না, মজার দৃশ্য দরকার।',
    ],
    tips: [
      'বাস্তব জীবনের ঘটনা থেকে গল্প নিন — বাজার, বাস, বিয়েবাড়ির মজার ঘটনা সবাই চিনবে, তাই বেশি শেয়ার হয়।',
      'নিজের গ্রাম/পাড়ার চরিত্র ব্যবহার করুন — তাহলে দর্শক কমেন্টে লিখবে “আরে, এ তো আমাদের পাড়ার ওস্তাদ!”, আর এনগেজমেন্ট বাড়বে।',
    ],
    accent: {
      badge: 'bg-amber-100 text-amber-800 border-amber-300',
      iconText: 'text-amber-600',
      step: 'bg-amber-100 text-amber-700',
      tip: 'border-amber-200 bg-amber-50',
      tipTitle: 'text-amber-700',
    },
  },
  {
    id: 'lesson-2',
    number: 2,
    emoji: '🧑‍🎨',
    icon: Palette,
    tag: 'ডিজাইন',
    title: 'পাঠ ২: ক্যারেক্টার ডিজাইন',
    intro:
      'কমেডি কার্টুনের প্রাণ হলো ক্যারেক্টার। এই প্ল্যাটফর্মের “ক্যারেক্টার তৈরি” ট্যাবে গিয়ে মিনিটেই আপনার নিজের গোপাল-ভাঁড় স্টাইলের চরিত্র বানিয়ে ফেলুন।',
    steps: [
      'উপরের মেনু থেকে “ক্যারেক্টার তৈরি” ট্যাবে যান।',
      'স্কিন রঙ, চুলের স্টাইল আর পোশাক বাছুন — পাঞ্জাবি, লুঙ্গি বা শাড়ি স্টাইল দিলেই আসল দেশি মেজাজ চলে আসবে।',
      'চশমা, দাড়ি বা টুপি যোগ করে চরিত্রকে আলাদা চেহারা দিন।',
      'গল্পের প্রতিটি চরিত্রের জন্য একেকটা আলাদা ক্যারেক্টার বানান — দেখতেও আলাদা হবে, ভয়েসও আলাদা দিন।',
      'ভয়েস সেটিং ঠিক করে “সেভ” করুন — পরে স্টুডিওতে এই ক্যারেক্টারগুলো সরাসরি ব্যবহার করা যাবে।',
    ],
    tips: [
      'বড় মাথা + ছোট শরীর = কমেডি স্টাইল। বিখ্যাত সব কার্টুন চরিত্রই এই ফর্মুলায় বানানো!',
      'নায়ক আর ভাঁড়ের চেহারা যত আলাদা হবে, দর্শক তত সহজে চিনবে — রঙ আর পোশাক দিয়ে পার্থক্য আনুন।',
    ],
    accent: {
      badge: 'bg-rose-100 text-rose-800 border-rose-300',
      iconText: 'text-rose-600',
      step: 'bg-rose-100 text-rose-700',
      tip: 'border-rose-200 bg-rose-50',
      tipTitle: 'text-rose-700',
    },
  },
  {
    id: 'lesson-3',
    number: 3,
    emoji: '🏞️',
    icon: ImageIcon,
    tag: 'সিন',
    title: 'পাঠ ৩: সিন সাজানো',
    intro:
      'এবার গল্পের প্রথম দৃশ্য সাজান। “স্টুডিও” ট্যাবে গিয়ে ব্যাকগ্রাউন্ড আর ক্যারেক্টার বসিয়ে দিন — যেন দর্শক সাথে সাথে বুঝতে পারে গল্পটা কোথায় হচ্ছে।',
    steps: [
      'উপরের মেনু থেকে “স্টুডিও” ট্যাবে যান।',
      'ব্যাকগ্রাউন্ড সিলেক্ট করুন — গ্রাম, বাজার, মাঠ বা ঘর — গল্প অনুযায়ী জায়গা বাছুন।',
      'সিনে আপনার সেভ করা ক্যারেক্টার বসান।',
      'X পজিশন ও সাইজ ঠিক করুন — যে ক্যারেক্টার কথা বলবে, তাকে সামনে-মাঝখানে বড় করে রাখুন।',
      'Flip বাটন দিয়ে মুখ ঘুরান — যেন দুই ক্যারেক্টার একে অপরের দিকে মুখ করে দাঁড়িয়ে কথা বলে।',
    ],
    tips: [
      'এক সিনে ২–৩টার বেশি ক্যারেক্টার রাখবেন না — মোবাইল স্ক্রিনে সবাইকে চেনা কঠিন হয়ে যায়।',
      'প্রতিটা দৃশ্যের শুরুতে জায়গা বদলালে ব্যাকগ্রাউন্ডও বদলান, নাহলে গল্প একঘেয়ে লাগবে।',
    ],
    accent: {
      badge: 'bg-orange-100 text-orange-800 border-orange-300',
      iconText: 'text-orange-600',
      step: 'bg-orange-100 text-orange-700',
      tip: 'border-orange-200 bg-orange-50',
      tipTitle: 'text-orange-700',
    },
  },
  {
    id: 'lesson-4',
    number: 4,
    emoji: '🎬',
    icon: Clapperboard,
    tag: 'অ্যাকশন',
    title: 'পাঠ ৪: দৃশ্য (বিট) বানানো ও অ্যাকশন',
    intro:
      'বিট মানে গল্পের এক-একটা ছোট অংশ — প্রতিটা বিটে থাকে একটা অ্যাকশন আর একটা ডায়ালগ। গোটা কার্টুন = অনেকগুলো বিট পরপর সাজানো।',
    steps: [
      'স্টুডিওতে “বিট/দৃশ্য যোগ” বাটনে চাপ দিয়ে নতুন বিট যোগ করুন।',
      'কোন ক্যারেক্টর কী অ্যাকশন করবে সিলেক্ট করুন — কথা বলা, হাঁটা, হাসা, রাগ করা, কান্না ইত্যাদি।',
      'ডায়ালগ বক্সে ক্যারেক্টরের কথা লিখুন — ছোট ছোট বাক্যে, যেন পড়তে সহজ হয়।',
      'সময় (duration) সেট করুন — ডায়ালগ পড়ার মতো সময় দিন, সাধারণত ২–৪ সেকেন্ড যথেষ্ট।',
      'দুই ক্যারেক্টরের মধ্যে মজার পালা-বাদান লিখুন — একজন মূর্খ-ভাঁড়, আরেকজন রাগী-হাসাহাসি, এই জুটিতেই হাসি আসে।',
    ],
    tips: [
      'প্রতি বিটে ১-২ লাইনের বেশি ডায়ালগ না! লম্বা ডায়ালগে দর্শক বিরক্ত হয়ে ভিডিও ছেড়ে চলে যায়।',
      'শুরুর ৫ সেকেন্ডেই কৌতূহল তৈরি করুন — প্রথম বিটেই ঝামেলার ইঙ্গিত দিন।',
    ],
    accent: {
      badge: 'bg-teal-100 text-teal-800 border-teal-300',
      iconText: 'text-teal-600',
      step: 'bg-teal-100 text-teal-700',
      tip: 'border-teal-200 bg-teal-50',
      tipTitle: 'text-teal-700',
    },
  },
  {
    id: 'lesson-5',
    number: 5,
    emoji: '🎙️',
    icon: Mic,
    tag: 'ভয়েস',
    title: 'পাঠ ৫: ভয়েস ও সাউন্ড',
    intro:
      'কার্টুনে ভয়েস না থাকলে অর্ধেক মজা নেই। প্রতিটি ক্যারেক্টরের আলাদা কণ্ঠ দিলেই কার্টুন জীবন্ত হয়ে ওঠে।',
    steps: [
      'প্রতিটা বিটের পাশে “ভয়েস জেনারেট” বাটনে চাপুন — লেখা ডায়ালগ কথা হয়ে যাবে।',
      'ভয়েস আগে থেকে সেট করা না থাকলে “ক্যারেক্টার তৈরি” ট্যাবে গিয়ে ক্যারেক্টরের ভয়েস সেট করুন।',
      'গোটা কার্টুনের সব বিটের ভয়েস একসাথে বানাতে “সব ভয়েস জেনারেট” বাটন ব্যবহার করুন।',
      'ভয়েস শুনে মিলিয়ে নিন — রাগী চরিত্রের কণ্ঠ ভারী, ভাঁড়ের কণ্ঠ হালকা-চিকন রাখলে মজা দ্বিগুণ হয়।',
      'ভয়েস ঠিক না লাগলে ডায়ালগের বানান একটু বদলে আবার জেনারেট করুন — উচ্চারণ বদলায়।',
    ],
    tips: [
      'এক ক্যারেক্টরের ভয়েস সব বিটে একই রাখুন — ভয়েস বদলালে দর্শক গুলিয়ে ফেলে।',
      'পালা-বাদানের সময় দুই ভয়েসের ধরন যত আলাদা, হাসি তত বেশি আসবে।',
    ],
    accent: {
      badge: 'bg-purple-100 text-purple-800 border-purple-300',
      iconText: 'text-purple-600',
      step: 'bg-purple-100 text-purple-700',
      tip: 'border-purple-200 bg-purple-50',
      tipTitle: 'text-purple-700',
    },
  },
  {
    id: 'lesson-6',
    number: 6,
    emoji: '📤',
    icon: Download,
    tag: 'এক্সপোর্ট',
    title: 'পাঠ ৬: ভিডিও এক্সপোর্ট ও ইউটিউব',
    intro:
      'সব বিট, অ্যাকশন আর ভয়েস ঠিক হয়ে গেল? এবার আপনার কার্টুনকে ভিডিও ফাইল বানিয়ে দুনিয়াকে দেখান!',
    steps: [
      '▶ প্লে বাটন দিয়ে পুরো কার্টুনটা শুরু থেকে শেষ দেখুন — ডায়ালগ, সময়, পজিশন সব ঠিক আছে কি না মিলিয়ে নিন।',
      '“ভিডিও এক্সপোর্ট” বাটনে চাপুন — ভিডিও ফাইল তৈরি হয়ে ডাউনলোড হয়ে যাবে।',
      'ভিডিওটা ইউটিউব বা ফেসবুকে আপলোড করুন।',
      'টাইটেল দিন মজার আর সার্চ-বান্ধব — যেমন: “গোপাল ভাঁড় বাজারে হাড়ি খেল!” ইউনিক টাইটেল = বেশি ভিউ।',
      'নিয়মিত আপলোড করুন — প্রতি সপ্তাহে অন্তত ২–৩টা কার্টুন; নিয়মিত আপলোড = সাবস্ক্রাইবার বাড়ে।',
    ],
    tips: [
      'থাম্বনেইলে ক্যারেক্টরের সবচেয়ে মজার এক্সপ্রেশন রাখুন — ভালো থাম্বনেইল মানেই ডাবল ক্লিক!',
      'কমেন্টের রিপ্লাই দিন — যত বেশি কথা-বাতা, তত দ্রুত চ্যানেল বাড়ে।',
    ],
    accent: {
      badge: 'bg-emerald-100 text-emerald-800 border-emerald-300',
      iconText: 'text-emerald-600',
      step: 'bg-emerald-100 text-emerald-700',
      tip: 'border-emerald-200 bg-emerald-50',
      tipTitle: 'text-emerald-700',
    },
  },
];

export default function CoursesTab({ onOpenStudio }: { onOpenStudio: () => void }) {
  const [completed, setCompleted] = useState<string[]>([]);

  // হাইড্রেশন-সেফ: SSR-এ খালি অ্যারে, ক্লায়েন্টে localStorage থেকে লোড
  // (টাইমার কলব্যাকে সেট করা হয় যেন রেন্ডারের ভেতরে সিঙ্ক্রোনাস setState না হয়)
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const valid = parsed
            .filter((id): id is string => typeof id === 'string')
            .filter((id) => LESSONS.some((lesson) => lesson.id === id));
          setCompleted(Array.from(new Set(valid)));
        }
      } catch {
        // ভাঙা ডেটা থাকলে ডিফল্ট অবস্থায় থাকবে
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggleLesson = (lessonId: string, checked: boolean | 'indeterminate') => {
    const next =
      checked === true
        ? Array.from(new Set([...completed, lessonId]))
        : completed.filter((id) => id !== lessonId);
    setCompleted(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // স্টোরেজ না চললেও UI স্টেট আপডেট হবে
    }
  };

  const completedCount = completed.length;
  const progressPercent = Math.round((completedCount / LESSONS.length) * 100);
  const allDone = completedCount === LESSONS.length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      {/* হিরো ব্যানার */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 p-6 text-white shadow-lg sm:p-10">
        <span aria-hidden className="pointer-events-none absolute -top-4 right-6 text-7xl opacity-20">🎬</span>
        <span aria-hidden className="pointer-events-none absolute bottom-4 right-24 text-6xl opacity-20">😂</span>
        <span aria-hidden className="pointer-events-none absolute -bottom-6 right-48 hidden text-7xl opacity-15 sm:inline">🎭</span>
        <Badge className="border-white/30 bg-white/20 text-white backdrop-blur">
          🆓 সম্পূর্ণ ফ্রি কোর্স
        </Badge>
        <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-4xl">
          কার্টুন বানানো শিখুন — ধাপে ধাপে
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
          এই ফ্রি কোর্সে ৬টি সহজ পাঠে শিখুন কীভাবে ঠাট্টা স্টুডিও দিয়ে গোপাল ভাঁড়-স্টাইলের মজার কমেডি
          কার্টুন বানানো যায় — গল্প লেখা থেকে ইউটিউবে আপলোড পর্যন্ত। কোনো অভিজ্ঞতা লাগবে না, শুধু এই
          প্ল্যাটফর্মটাই যথেষ্ট!
        </p>
        <Button
          onClick={onOpenStudio}
          size="lg"
          className="mt-5 bg-white font-bold text-orange-600 shadow-md hover:bg-amber-50"
        >
          <Sparkles className="size-4" />
          স্টুডিওতে প্র্যাকটিস শুরু করুন
        </Button>
      </section>

      {/* অগ্রগতি কার্ড */}
      <Card className="border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/60">
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <GraduationCap className="size-5 text-orange-600" />
              আপনার অগ্রগতি
            </div>
            <div className="flex items-center gap-2">
              {allDone && (
                <Badge className="border-emerald-300 bg-emerald-100 text-emerald-800">
                  🎉 কোর্স সম্পন্ন!
                </Badge>
              )}
              <span className="text-sm font-semibold text-orange-700">
                {toBangla(completedCount)}/{toBangla(LESSONS.length)} পাঠ সম্পন্ন
              </span>
            </div>
          </div>
          <Progress
            value={progressPercent}
            className="h-3 bg-amber-100 [&>div]:bg-gradient-to-r [&>div]:from-amber-500 [&>div]:via-orange-500 [&>div]:to-rose-500"
          />
          <p className="text-xs text-muted-foreground">
            {allDone
              ? 'অভিনন্দন! গল্প থেকে এক্সপোর্ট — পুরো প্রসেস শিখে গেছেন। এবার নিজের কার্টুন চ্যানেল চালু করার পালা!'
              : `আরও ${toBangla(LESSONS.length - completedCount)}টা পাঠ বাকি আছে — পাঠ শেষ করে নিচের চেকবক্সে টিক দিন।`}
          </p>
        </CardContent>
      </Card>

      {/* পাঠসমূহ */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-foreground">
            <BookOpen className="size-5 text-orange-600" />
            কোর্স পাঠসমূহ
          </h2>
          <span className="text-xs text-muted-foreground">👆 পাঠের নামে চাপ দিয়ে খুলুন</span>
        </div>

        <Accordion type="multiple" defaultValue={['lesson-1']} className="space-y-3">
          {LESSONS.map((lesson) => {
            const Icon = lesson.icon;
            const isDone = completed.includes(lesson.id);
            return (
              <AccordionItem
                key={lesson.id}
                value={lesson.id}
                className="rounded-2xl border bg-card px-4 shadow-sm transition-shadow data-[state=open]:shadow-md sm:px-5"
              >
                <AccordionTrigger className="gap-3 py-4 hover:no-underline">
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-full border text-sm font-extrabold',
                        lesson.accent.badge
                      )}
                    >
                      {toBangla(lesson.number)}
                    </span>
                    <span className="flex min-w-0 flex-col items-start gap-0.5">
                      <span className="flex items-center gap-1.5">
                        <span aria-hidden>{lesson.emoji}</span>
                        <span className="truncate text-sm font-bold sm:text-base">
                          {lesson.title}
                        </span>
                      </span>
                      <span
                        className={cn(
                          'flex items-center gap-1 text-xs font-medium',
                          lesson.accent.iconText
                        )}
                      >
                        <Icon className="size-3.5" />
                        {lesson.tag}
                      </span>
                    </span>
                    {isDone && <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />}
                  </span>
                </AccordionTrigger>

                <AccordionContent className="space-y-4 pb-4">
                  <p className="text-sm leading-relaxed text-foreground/90">{lesson.intro}</p>

                  <ol className="space-y-2.5">
                    {lesson.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span
                          className={cn(
                            'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                            lesson.accent.step
                          )}
                        >
                          {toBangla(i + 1)}
                        </span>
                        <span className="text-sm leading-relaxed text-foreground/90">{step}</span>
                      </li>
                    ))}
                  </ol>

                  <div className={cn('rounded-xl border p-3', lesson.accent.tip)}>
                    <p
                      className={cn(
                        'flex items-center gap-1.5 text-xs font-bold',
                        lesson.accent.tipTitle
                      )}
                    >
                      <Lightbulb className="size-3.5" />
                      💡 টিপস
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {lesson.tips.map((tip, i) => (
                        <li key={i} className="flex gap-2 text-sm leading-relaxed text-foreground/90">
                          <span aria-hidden className="shrink-0">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-dashed border-amber-300 bg-orange-50/50 p-3">
                    <label
                      htmlFor={`${lesson.id}-done`}
                      className="flex cursor-pointer items-center gap-3"
                    >
                      <Checkbox
                        id={`${lesson.id}-done`}
                        checked={isDone}
                        onCheckedChange={(checked) => toggleLesson(lesson.id, checked)}
                        className="size-5 data-[state=checked]:border-emerald-500 data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white"
                      />
                      <span className="text-sm font-semibold text-foreground">
                        আমি এই পাঠ শেষ করেছি
                      </span>
                      {isDone && <CheckCircle2 className="ml-auto size-4 text-emerald-600" />}
                    </label>
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>

      {/* শেষ কথা */}
      <Card className="border-purple-200 bg-gradient-to-br from-purple-50 via-rose-50 to-amber-50">
        <CardContent className="space-y-4 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-purple-100 text-2xl">
            🏆
          </div>
          <h2 className="text-xl font-extrabold text-foreground">🏆 শেষ কথা</h2>
          <p className="mx-auto max-w-2xl text-sm leading-relaxed text-foreground/90 sm:text-base">
            মনে রাখবেন — দারুণ ক্রিয়েটর হওয়ার কোনো ম্যাজিক নেই, শুধু অভ্যাস আছে। প্রতিদিন ১টা কার্টুন
            বানালে ৩০ দিনে আপনি ভাইরাল ক্রিয়েটর হতে পারেন! আজকেই পাঠ ১ শুরু করুন, আর ঠাট্টা স্টুডিও
            দিয়ে নিজের গল্প দুনিয়াকে শোনান।
          </p>
          <Button
            onClick={onOpenStudio}
            size="lg"
            className="bg-gradient-to-r from-orange-500 to-rose-500 font-bold text-white shadow-md hover:from-orange-600 hover:to-rose-600"
          >
            <Sparkles className="size-4" />
            স্টুডিওতে প্র্যাকটিস শুরু করুন
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
