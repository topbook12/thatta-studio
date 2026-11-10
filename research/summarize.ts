import { readFileSync } from 'fs';
const data = JSON.parse(readFileSync('/home/z/my-project/research/search-results.json', 'utf-8'));
for (const topic of data) {
  console.log(`\n===== TOPIC: ${topic.topic} =====`);
  for (const r of topic.results.slice(0, 8)) {
    const snip = (r.snippet || '').replace(/\s+/g, ' ').slice(0, 260);
    console.log(`- [${r.host_name}] ${r.name?.slice(0, 90)} :: ${snip}`);
  }
}
