import ZAI from 'z-ai-web-dev-sdk';
import { writeFileSync } from 'fs';

interface SearchOutcome {
  topic: string;
  query: string;
  results: Array<{ name: string; url: string; snippet: string; date?: string; host_name?: string }>;
  error?: string;
}

const SEARCH_PLAN: Array<{ topic: string; query: string; num?: number }> = [
  {
    topic: 'Gopal Bhand Bangla comedy cartoon phenomenon (market validation)',
    query: 'গোপাল ভাঁড় কার্টুন বাংলা কমেডি অ্যানিমেশন ইউটিউব ভাইরাল সাবস্ক্রাইবার',
    num: 8,
  },
  {
    topic: 'Existing no-code cartoon animation platforms (competitors)',
    query: 'Animaker vs Vyond vs Toonly no-code 2D cartoon animation platform features pricing 2025',
    num: 8,
  },
  {
    topic: 'Browser-based 2D character animation technology stack',
    query: 'browser based 2D character animation library Rive PixiJS Konva canvas WebGL skeletal rigging',
    num: 8,
  },
  {
    topic: 'PWA capability for canvas/WebGL heavy animation apps',
    query: 'progressive web app PWA canvas WebGL animation editor offline service worker installable capability',
    num: 8,
  },
  {
    topic: 'Bangla TTS / voice & dubbing support (key feature)',
    query: 'Bangla Bengali text to speech TTS voice over cartoon video dubbing AI',
    num: 8,
  },
  {
    topic: 'Animation learning demand in Bangladesh / course market',
    query: 'animation course demand Bangladesh 2D animation learn freelancing cartoon making',
    num: 8,
  },
  {
    topic: 'Character creator (avatar builder) implementation approach',
    query: 'layered SVG character creator avatar builder web app implementation customizer',
    num: 8,
  },
  {
    topic: 'AI-assisted cartoon video generation trends 2025',
    query: 'AI cartoon video generator text to animation lip sync 2025 tools',
    num: 8,
  },
];

async function runWebSearch(zai: any, query: string, num?: number) {
  return await zai.functions.invoke('web_search', { query, num: num ?? 8 });
}

async function main() {
  const zai = await ZAI.create();
  const outcomes: SearchOutcome[] = [];

  for (const plan of SEARCH_PLAN) {
    let results: any[] = [];
    let error: string | undefined;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await runWebSearch(zai, plan.query, plan.num);
        results = Array.isArray(res) ? res : (res?.results ?? []);
        if (results.length > 0) break;
      } catch (e: any) {
        error = e?.message ?? String(e);
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
    outcomes.push({
      topic: plan.topic,
      query: plan.query,
      results: results.map((r: any) => ({
        name: r.name,
        url: r.url,
        snippet: r.snippet,
        date: r.date,
        host_name: r.host_name,
      })),
      error,
    });
    console.log(`[OK] ${plan.topic} -> ${results.length} results ${error ? '(err: ' + error + ')' : ''}`);
    await new Promise((r) => setTimeout(r, 600));
  }

  writeFileSync('/home/z/my-project/research/search-results.json', JSON.stringify(outcomes, null, 2), 'utf-8');
  console.log('Saved to research/search-results.json');
}

main().catch((e) => {
  console.error('FATAL', e);
  process.exit(1);
});
