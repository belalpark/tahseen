import json
import sys
H=json.load(open(sys.argv[1]))
names={1:'الفاتحة',2:'البقرة',99:'الزلزلة',69:'الحاقة',44:'الدخان',37:'الصافات',8:'الأنفال'}
basmala=H['fatiha']['ayahs'][0]['t']
def part(k, bas):
    v=H[k]; return {"s":v['surah'],"sname":names[v['surah']],"from":v["from"],"to":v["to"],"total":v["count"],"basmala":bas,"ayahs":[[a['n'],a['t']] for a in v['ayahs']]}
pages=[
 {"id":"tahrij","kind":"dhikr","title":"التحريج","short":"التحريج",
  "text":"دخلت على جسدي بلا إله إلا الله، أناشد كل من سكن جسدي من الشياطين ومن السحر والحسد والعين ترك جسدي طاعةً لله ولرسوله ﷺ، لا تؤذوني ولا أؤذيكم"},
 {"id":"tahseen","kind":"dhikr","title":"التحصين","short":"التحصين",
  "text":"تحصنت بلا إله إلا الله، تحصنت برب الفلق من شر ما خلق"},
 {"id":"fatiha","kind":"quran","title":"سورة الفاتحة","short":"الفاتحة","parts":[part('fatiha',False)]},
 {"id":"baqarah","kind":"quran","title":"سورة البقرة","short":"سورة البقرة","sub":"أولها (1 – 5) · آية الكرسي · خواتيمها (285 – 286)",
  "parts":[dict(part('baqarah1',True),label="أوائل السورة · الآيات 1 – 5"),dict(part('kursi',False),label="آية الكرسي · الآية 255"),dict(part('baqarah2',False),label="خواتيم السورة · الآيتان 285 – 286")]},
 {"id":"zalzalah","kind":"quran","title":"سورة الزلزلة","short":"سورة الزلزلة","parts":[part('zalzalah',True)]},
 {"id":"haqqah","kind":"quran","title":"سورة الحاقة","short":"سورة الحاقة","parts":[part('haqqah',True)]},
 {"id":"dukhan","kind":"quran","title":"سورة الدخان","short":"سورة الدخان","parts":[part('dukhan',True)]},
 {"id":"saffat","kind":"quran","title":"سورة الصافات","short":"سورة الصافات","parts":[part('saffat',True)]},
 {"id":"anfal","kind":"quran","title":"سورة الأنفال","short":"سورة الأنفال","parts":[part('anfal',True)]},
]
doc={"basmala":basmala,"pages":pages,
 "source":"نص القرآن: مصحف المدينة برواية حفص (مجمع الملك فهد لطباعة المصحف الشريف، الإصدار 3.0) عبر مجموعة بيانات quran-text (CC BY 4.0)، ومطابَق آيةً آية مع نص موسوعة القرآن الكريم (QuranEnc) ونص Tanzil."}
open(sys.argv[2],'w').write(json.dumps(doc,ensure_ascii=False,separators=(',',':')))
print(sum(len(a['ayahs']) for p in pages if p['kind']=='quran' for a in p['parts']), 'ayahs;', len(pages),'pages')
