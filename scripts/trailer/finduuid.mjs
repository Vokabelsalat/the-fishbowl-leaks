import { randomUUID } from "node:crypto";
const all = ["fish","crab","jellyfish","octopus","turtle","ray","starfish","seahorse","seal","shrimp","narwhal","dolphin","whale","clam","pufferfish"];
const sea = all.filter(f => f !== "whale");
const h = s => { let x = 2166136261; for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); } return x >>> 0; };
const want = ["octopus","seahorse","turtle","pufferfish","narwhal","dolphin","fish","ray"]; const found = {};
while (Object.keys(found).length < want.length) { const u = randomUUID(); const a = all[h(u) % all.length], b = sea[h(u) % sea.length]; if (a === b && want.includes(a) && !found[a]) found[a] = u; }
console.log(JSON.stringify(found));
