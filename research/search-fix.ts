import ZAI from 'z-ai-web-dev-sdk';
import { readFileSync, writeFileSync } from 'fs';

const EXTRA: Array<{ topic: string; query: string }> = [
  { topic: 'Existing no-code cartoon animation platforms (competitors)', query: 'Animaker no code animation tool pricing features' },
  { topic: 'Competitor details', query: 'Vyond Toonly Plotagon cartoon video maker comparison' },
  { topic: 'Mobile animation apps for amateurs', query: 'FlipaClip mobile animation app beginners' },
];

async function main() {
  const zai = await ZAI.create();
  const data = JSON.parse(readFileSync('/home/z/my-project/research/search-results.json', 'utf-8'));
  for (const plan of EXTRA) {
    let ok = false;
    for (let i = 1; i <= 3 && !ok; i++) {
      try {
        const res = await zai.functions.invoke('web_search', { query: plan.query, num: 8 });
        const results = Array.isArray(res) ? res : (res?.results ?? []);
        data.push({ topic: plan.topic, query: plan.query, results: results.map((r: any) => ({ name: r.name, url: r.url, snippet: r.snippet, date: r.date, host_name: r.host_name })) });
        console.log(`[OK] ${plan.query} -> ${results.length}`);
        ok = results.length > 0;
      } catch (e: any) {
        console.log(`[RETRY ${i}] ${plan.query}: ${e?.message?.slice(0, 120)}`);
        await new Promise(r => setTimeout(r, 800 * i));
      }
    }
    await new Promise(r => setTimeout(r, 500));
  }
  writeFileSync('/home/z/my-project/research/search-results.json', JSON.stringify(data, null, 2), 'utf-8');
  console.log('done');
}
main();
