import ZAI from 'z-ai-web-dev-sdk';
import { writeFileSync } from 'fs';

const EXTRA: Array<{ topic: string; query: string }> = [
  { topic: 'How Bangla funny cartoon creators actually make videos (tools used)', query: 'প্লটাগন দিয়ে কার্টুন ভিডিও বানানো বাংলা টিউটোরিয়াল' },
  { topic: 'How Bangla funny cartoon creators actually make videos 2', query: 'বাংলা ফানি কার্টুন ভিডিও কিভাবে বানায় সফটওয়্যার' },
  { topic: 'Browser video export technology (canvas to video)', query: 'canvas MediaRecorder WebCodecs export video web app client side rendering' },
  { topic: 'Rive licensing and editor', query: 'Rive animation editor free plan pricing license runtime' },
  { topic: 'Skeletal animation open source web', query: 'open source 2D skeletal animation web DragonBones EaselJS cutout animation' },
];

async function main() {
  const zai = await ZAI.create();
  const out: any[] = [];
  for (const plan of EXTRA) {
    let results: any[] = [];
    for (let i = 1; i <= 3; i++) {
      try {
        const res = await zai.functions.invoke('web_search', { query: plan.query, num: 7 });
        results = Array.isArray(res) ? res : (res?.results ?? []);
        if (results.length) break;
      } catch (e: any) { await new Promise(r => setTimeout(r, 800 * i)); }
    }
    out.push({ topic: plan.topic, query: plan.query, results: results.map((r: any) => ({ name: r.name, url: r.url, snippet: r.snippet, host_name: r.host_name })) });
    console.log(`[OK] ${plan.topic} -> ${results.length}`);
    await new Promise(r => setTimeout(r, 600));
  }
  writeFileSync('/home/z/my-project/research/search-deep.json', JSON.stringify(out, null, 2), 'utf-8');
}
main();
