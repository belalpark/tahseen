// Extracts the ruqyah surahs/ayahs from the KFGQPC Hafs v3.0 dataset (@quran.ws/text).
import fs from "fs";
import path from "path";
const pkg = process.argv[2], out = process.argv[3];
const { Mushaf } = await import(path.resolve(pkg, "quran-text.js"));
const m = await Mushaf.hafs();
const sel = [
  { key: "fatiha", s: 1, from: 1, to: 7 },
  { key: "kursi", s: 2, from: 255, to: 255 },
  { key: "baqarah1", s: 2, from: 1, to: 5 },
  { key: "baqarah2", s: 2, from: 285, to: 286 },
  { key: "zalzalah", s: 99 }, { key: "haqqah", s: 69 }, { key: "dukhan", s: 44 }, { key: "saffat", s: 37 }, { key: "anfal", s: 8 },
];
const res = {};
for (const x of sel) {
  const su = m.surah(x.s);
  const from = x.from || 1, to = x.to || su.ayahs.length, ayahs = [];
  for (let a = from; a <= to; a++) { const ay = m.ayah(x.s, a); ayahs.push({ n: a, t: ay.render({ marks: true }), plain: ay.text }); }
  res[x.key] = { surah: x.s, name: su.nameAr, count: su.ayahs.length, from, to, ayahs };
}
fs.writeFileSync(out, JSON.stringify(res, null, 1));
console.log("extracted", Object.values(res).reduce((a, v) => a + v.ayahs.length, 0), "ayahs");
