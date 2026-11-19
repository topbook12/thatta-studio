// ============================================================
// ঠাট্টা স্টুডিও — Phase 3: দুই-ক্যারেক্টার ইন্টারঅ্যাকশন প্রিসেট
//
// A preset builds a small choreography of beats for TWO actors
// (A = initiator, B = partner). Starts are RELATIVE to the insertion
// time; the dialog shifts them onto the scene's timeline. Reactions
// are timed on impact (slap → surprise → fall) like real comic timing.
// ============================================================

import type { SceneBeat } from './types';

type BeatDraft = Omit<SceneBeat, 'id' | 'actorUid'> & { actor: 'A' | 'B' };

export interface InteractionPreset {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  /** total duration in seconds (shown in the picker) */
  length: number;
  build: (baseXA: number, baseXB: number) => BeatDraft[];
}

export const INTERACTION_PRESETS: InteractionPreset[] = [
  {
    id: 'conversation',
    emoji: '💬',
    name: 'কথোপকথন',
    desc: 'দুজন মুখোমুখি দাঁড়িয়ে পালা করে কথা বলে, শেষে একজন মাথা নাড়ে',
    length: 7.4,
    build: () => [
      { actor: 'A', action: 'talk', start: 0, duration: 2.6, text: 'সুনেন, আজকের বাজারে কী খবর?' },
      { actor: 'B', action: 'talk', start: 2.6, duration: 2.8, text: 'খবর শুনবেন না! মিষ্টির দাম আবার বাড়ল!' },
      { actor: 'A', action: 'surprise', start: 5.4, duration: 2.0, text: 'কী! এত দাম কেন বাপ?' },
    ],
  },
  {
    id: 'slap',
    emoji: '🖐️',
    name: 'থাপ্পড় কাণ্ড',
    desc: 'ইশারা → থাপ্পড় → চমকে ওঠা → পড়ে যাওয়া → বিজয়ীর হাসি (ইমপ্যাক্ট টাইমিং)',
    length: 8.2,
    build: () => [
      { actor: 'A', action: 'point', start: 0, duration: 1.4, text: 'এইবার দেখো তোকে!' },
      { actor: 'A', action: 'slap', start: 1.4, duration: 1.6, text: '' },
      { actor: 'B', action: 'surprise', start: 2.5, duration: 1.8, text: 'হাঁ হাঁ! কী মারলি!' },
      { actor: 'B', action: 'fall', start: 4.3, duration: 2.4, text: 'পা দুটো গেল রে বাবা!' },
      { actor: 'A', action: 'laugh', start: 5.2, duration: 3.0, text: 'হা হা হা! লেজের শক্তি দেখলি?' },
    ],
  },
  {
    id: 'chase',
    emoji: '🏃',
    name: 'ধাওয়া (বহিষ্কার)',
    desc: 'B দৌড়ে পালায়, A তার পিছু ধাওয়া — তারপর বিরতি ও হুমকি',
    length: 9.2,
    build: () => [
      { actor: 'B', action: 'run', start: 0, duration: 2.8, moveTo: 88, easing: 'easeInOut', text: 'বাঁচাও! এই মহলে পাগল!' },
      { actor: 'A', action: 'run', start: 0.7, duration: 3.0, moveTo: 84, easing: 'easeInOut', text: 'থাম! থাম না হলে দেখ!' },
      { actor: 'B', action: 'shiver', start: 3.4, duration: 2.4, text: 'গুরু, ভুল করিনি আর!' },
      { actor: 'A', action: 'point', start: 3.7, duration: 2.6, text: 'পরেরবার স্বপ্নেও কাছে আসিস না!' },
    ],
  },
  {
    id: 'greeting',
    emoji: '🙏',
    name: 'সালাম-সম্মান',
    desc: 'একজন নমস্কার করে, অন্যজন বিনয়ের সাথে জবাব দেয় — উষ্ণ সংবর্ধন',
    length: 8.4,
    build: () => [
      { actor: 'A', action: 'bow', start: 0, duration: 2.2, text: 'প্রণাম গুরুজন!' },
      { actor: 'B', action: 'bow', start: 1.7, duration: 2.2, text: 'সাবধানে যাও বাবা।' },
      { actor: 'A', action: 'wave', start: 4.0, duration: 2.4, text: 'আবার দেখা হবে!' },
      { actor: 'B', action: 'nod', start: 4.4, duration: 2.0, text: '' },
    ],
  },
  {
    id: 'celebrate',
    emoji: '🎉',
    name: 'একসাথে উদযাপন',
    desc: 'দুজন একসাথে জয়ধোঁয়া — তারপর হাসি আর তালি',
    length: 8.0,
    build: () => [
      { actor: 'A', action: 'celebrate', start: 0, duration: 3.2, text: 'জয় জয়! দিন ধরে এসেছে!' },
      { actor: 'B', action: 'celebrate', start: 0.4, duration: 3.2, text: 'জয়ধোঁয়া! মিষ্টি হবে আজ!' },
      { actor: 'A', action: 'laugh', start: 3.6, duration: 2.6, text: 'হা হা হা!' },
      { actor: 'B', action: 'clap', start: 3.7, duration: 2.6, text: '' },
    ],
  },
  {
    id: 'tease',
    emoji: '😭',
    name: 'খোঁচা ও কান্না',
    desc: 'একজন হাসে খোঁচা দিয়ে, অন্যজন কাঁদে — তারপর অনুতাপ ও রাগ',
    length: 9.4,
    build: () => [
      { actor: 'A', action: 'laugh', start: 0, duration: 2.6, text: 'হা হা হা! লুঙ্গি খুলে গেল দেখলাম!' },
      { actor: 'B', action: 'cry', start: 1.8, duration: 3.2, text: 'ও বাবা, মান মরল রে!' },
      { actor: 'A', action: 'think', start: 3.6, duration: 2.2, text: 'আচ্ছা... বেশি তো না হাসলাম?' },
      { actor: 'B', action: 'angry', start: 4.6, duration: 2.8, text: 'রাগ ধরেছে ধরেছে বড়!' },
    ],
  },
];

/** Turn a preset into real beat drafts at `baseTime` + relative starts. */
export function buildInteractionBeats(
  preset: InteractionPreset,
  aUid: string,
  bUid: string,
  baseTime: number,
): Omit<SceneBeat, 'id'>[] {
  const round = (n: number) => Math.round(n * 20) / 20;
  return preset
    .build(50, 50)
    .map(({ actor, ...rest }) => ({
      ...rest,
      actorUid: actor === 'A' ? aUid : bUid,
      start: round(Math.max(0, baseTime) + (rest.start ?? 0)),
    }));
}
