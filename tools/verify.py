"""Cross-checks every ayah used by the app against two independent sources.
argv: sel_hafs.json  quran-json/dist/quran.json  tanzil-qurandb(sqlite)"""
import json, re, sqlite3, sys, unicodedata
H = json.load(open(sys.argv[1])); Q = json.load(open(sys.argv[2])); T = sqlite3.connect(sys.argv[3]).cursor()
BAS = 'بسم الله الرحمن الرحيم'
def skel(t):
    t = unicodedata.normalize('NFKD', t)
    t = ''.join(c for c in t if not unicodedata.category(c).startswith('M') and c not in 'ـ۝'
                and not ('ۖ' <= c <= 'ۭ') and not ('࣓' <= c <= 'ࣿ'))
    t = t.translate(str.maketrans({'ٱ':'ا','أ':'ا','إ':'ا','آ':'ا','ى':'ي','ۦ':'','ۥ':'','ؤ':'و','ئ':'ي','ء':'','ة':'ه'}))
    return re.sub(r'\s+', ' ', re.sub(r'[^ء-ي ]', '', t)).strip()
nospace = lambda s: s.replace(' ', '')
loose = lambda s: re.sub('[اويه ]', '', s)
n = 0
for k, v in H.items():
    s = v['surah']
    for a in v['ayahs']:
        n += 1
        h = skel(a['t'])
        q = skel(Q[s - 1]['verses'][a['n'] - 1]['text'])
        t = skel(T.execute('select ar from ar where chapter=? and verse=?', (s, a['n'])).fetchone()[0])
        if a['n'] == 1 and s != 1 and t.startswith(BAS): t = t[len(BAS):].strip()
        assert nospace(h) == nospace(q), f'QuranEnc mismatch {s}:{a["n"]}'
        assert loose(h) == loose(t), f'Tanzil mismatch {s}:{a["n"]}'
print(f'verified {n} ayahs against QuranEnc and Tanzil')
