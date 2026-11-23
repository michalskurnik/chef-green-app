"""Compare a page-saved Artifact version with your build and a fresh DB dump before republishing.

    python3 compare_live.py --live <saved.html from the refusal message> --build <out.html> --dump <dump_dir> [--prev <template or build matching the live code>]

Prints, per collection: counts and ids that are in the live copy but missing or different in your build,
and whether the live app code / last style block equal --prev (or --build when --prev is omitted).
Safe to republish when nothing is missing or different and the code matches your previous build.
"""
import re, json, glob, os, argparse

ap = argparse.ArgumentParser()
ap.add_argument('--live', required=True); ap.add_argument('--build', required=True)
ap.add_argument('--dump', required=True); ap.add_argument('--prev')
a = ap.parse_args()
SEED = re.compile(r'<script type="application/json" id="seed">(.*?)</script>', re.S)
APP = re.compile(r'<script id="app">(.*?)</script>', re.S)
STY = re.compile(r'<style>(.*?)</style>', re.S)
rd = lambda p: open(p, encoding='utf-8').read()
live, mine = rd(a.live), rd(a.build)
prev = rd(a.prev) if a.prev else mine
ls, ms = json.loads(SEED.search(live).group(1)), json.loads(SEED.search(mine).group(1))
la, pa = APP.search(live), APP.search(prev)
print('app code equals previous build:', bool(la and pa and la.group(1).strip() == pa.group(1).strip()))
lst, pst = STY.findall(live), STY.findall(prev)
print('last style block equals previous build:', bool(lst and pst and lst[-1].strip() == pst[-1].strip()))
clean = lambda d: {k: v for k, v in d.items() if not k.startswith('_')}


def dump(col):
    out = {}
    for f in glob.glob(os.path.join(a.dump, col, '*.json')):
        o = json.load(open(f, encoding='utf-8')); o['id'] = os.path.basename(f)[:-5]; out[o['id']] = o
    return out


safe = True
for col in sorted(set(ls) | set(ms)):
    if not isinstance(ls.get(col, []), list):
        continue
    L = {x['id']: clean(x) for x in ls.get(col, [])}; M = {x['id']: clean(x) for x in ms.get(col, [])}; D = dump(col)
    missing = [k for k in L if k not in M]
    differ = [k for k in L if k in M and L[k] != M[k] and str(L[k].get('updatedAt', L[k].get('at', ''))) > str(M[k].get('updatedAt', M[k].get('at', '')))]
    if missing or differ:
        safe = False
    print(f'{col}: live {len(L)} build {len(M)} dump {len(D)} | in live but not in build: {missing} | newer in live: {differ}')
print('live copy stamped', ls.get('at'), '| build stamped', ms.get('at'))
print('VERDICT:', 'build already contains everything in the live copy' if safe else 'dump again and rebuild before publishing')
