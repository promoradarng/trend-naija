#!/usr/bin/env python3
"""Match every non-owner story (front page + archive) to the owner's photo register in data/people.json.
  python3 tools/match_people.py --dry   list what would change
  python3 tools/match_people.py         apply, then run `node build.js`
Looks only at the headline. One person -> their photo; two people -> their pair photo if listed,
otherwise both photos side by side. Owner stories and stories already credited "Photo: Trend Naija" are left alone.
"""
import json,glob,re,shutil,os,sys
ROOT='.'
reg=json.load(open('data/people.json'))
P=reg['people'];PAIRS=reg['pairs']
EXTRA={'speed darlington':['speed darlington'],'tompolo':['tompolo'],'rochas okorocha':['okorocha'],'remi tinubu':['remi tinubu','oluremi tinubu']}
REL=r"(?:'s|’s)\s+(?:late\s+|elder\s+|younger\s+|ex-)?(?:son|daughter|wife|husband|sister|brother|mother|mum|father|dad|uncle|cousin|granddaughter|grandson|child|children|family|nephew|niece|girlfriend|boyfriend|baby mama)\b"
names={}
for k,v in P.items(): names[k]=[k]+v.get('aliases',[])
for k,v in EXTRA.items(): names[k]=v
BLOCK={'peter obi':[r'obi cubana',r'mikel obi',r'obi jackson',r'obi mikel'],'bola tinubu':[r'remi tinubu',r'oluremi tinubu',r'seyi tinubu',r'folasade tinubu',r'tinubu-ojo'],'peter mbah':[r'content creator peter mbah'],'davido':[r"davido's (?:elder )?sister"]}
def find(text):
    t=text.lower().replace('’',"'")
    hits=[]
    for k,al in names.items():
        tt=t
        for b in BLOCK.get(k,[]): tt=re.sub(b,' ',tt)
        best=None
        for a in sorted(al,key=len,reverse=True):
            for m in re.finditer(r'(?<![\w-])'+re.escape(a)+r'(?![\w-])',tt):
                if re.match(REL,tt[m.end():]): continue
                if best is None or m.start()<best: best=m.start()
        if best is not None: hits.append((best,k))
    hits.sort()
    out=[]
    for _,k in hits:
        if k=='bola tinubu' and 'remi tinubu' in out: pass
        if k not in out: out.append(k)
    return out
def choose(s):
    ppl=find(s['h'])

    if not ppl: return None
    if ppl[0]=='zlatan' and 'wedding' in s['h'].lower() and len(ppl)==1:
        z=reg['special']['zlatan + wedding']; return ('one',z['img'],z['alt'],ppl)
    if len(ppl)>=2:
        a,b=ppl[0],ppl[1]
        for key in (f'{a} + {b}',f'{b} + {a}'):
            if key in PAIRS: return ('one',PAIRS[key]['img'],PAIRS[key]['alt'],ppl)
        sing=[p for p in ppl if p in P][:2]
        if len(sing)==2: return ('two',[P[x]['img'] for x in sing],[P[x]['alt'] for x in sing],ppl)
        if len(sing)==1: return ('one',P[sing[0]]['img'],P[sing[0]]['alt'],ppl)
        return None
    if ppl[0] in P: return ('one',P[ppl[0]]['img'],P[ppl[0]]['alt'],ppl)
    return None
def apply(s):
    if s.get('owner') or (s.get('credit') or '').startswith('Photo: Trend Naija'): return None
    c=choose(s)
    if not c: return None
    sid=s['id']
    if c[0]=='one':
        dst=f'img/{sid}-tn.jpg'; shutil.copy(c[1],dst)
        s['img']=dst; s['alt']=c[2]; s.pop('imgs',None); s.pop('alts',None)
    else:
        d1,d2=f'img/{sid}-tn.jpg',f'img/{sid}-tn2.jpg'
        shutil.copy(c[1][0],d1);shutil.copy(c[1][1],d2)
        s.pop('img',None); s['imgs']=[d1,d2]; s['alts']=c[2]; s['alt']=' and '.join(c[2])
    s['credit']='Photo: Trend Naija'
    return c
if __name__=='__main__':
    dry='--dry' in sys.argv
    raw=open('data/stories.json').read(); D=json.loads(raw)
    n=0
    for s in D['stories']:
        c=choose(s) if (not s.get('owner') and not (s.get('credit') or '').startswith('Photo: Trend Naija')) else None
        if c:
            n+=1; print('LIVE',s['id'],c[3],c[0]); 
            if not dry: apply(s)
    if not dry: open('data/stories.json','w').write(json.dumps(D,indent=1,ensure_ascii=False)+'\n')
    for f in sorted(glob.glob('data/archive/*.json')):
        r=open(f).read(); s=json.loads(r)
        c=choose(s) if (not s.get('owner') and not (s.get('credit') or '').startswith('Photo: Trend Naija')) else None
        if c:
            n+=1; print('ARCH',s['id'],c[3],c[0])
            if not dry:
                apply(s); open(f,'w').write(json.dumps(s,indent=1,ensure_ascii=False)+('\n' if r.endswith('\n') else ''))
    print('total',n)
