"""Inject a data dump into a board template.

    python3 build_seed.py <template.html> <dump_dir> <out.html> [--tz-hours 2] [--collections items,releases,log,projects]

<dump_dir>/<collection>/<doc_id>.json is exactly what `ArtifactData action:list ... out_dir:<dump_dir>` writes.
The template must contain the literal __SEED__ inside <script type="application/json" id="seed">.
"""
import json, os, sys, datetime, argparse

ap = argparse.ArgumentParser()
ap.add_argument('template'); ap.add_argument('dump'); ap.add_argument('out')
ap.add_argument('--tz-hours', type=float, default=0, help='offset for the "copy from" stamp shown in the page')
ap.add_argument('--collections', default='items,releases,log,projects')
a = ap.parse_args()


def load(col):
    d = os.path.join(a.dump, col)
    out = []
    if not os.path.isdir(d):
        return out
    for f in sorted(os.listdir(d)):
        if f.endswith('.json') and not f.startswith('.'):
            with open(os.path.join(d, f), encoding='utf-8') as fh:
                o = json.load(fh)
            o['id'] = f[:-5]
            out.append(o)
    return out


now = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=a.tz_hours)
seed = {c: load(c) for c in a.collections.split(',')}
seed['at'] = now.strftime('%d/%m %H:%M')
seed['atIso'] = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.000Z')  # the page shows this in the viewer's local time
js = json.dumps(seed, ensure_ascii=False).replace('</', '<\\/')
with open(a.template, encoding='utf-8') as fh:
    s = fh.read()
if s.count('__SEED__') != 1:
    sys.exit(f'template must contain __SEED__ exactly once (found {s.count("__SEED__")})')
with open(a.out, 'w', encoding='utf-8') as fh:
    fh.write(s.replace('__SEED__', js))
print(' '.join(f'{c}={len(seed[c])}' for c in a.collections.split(',')), 'at', seed['at'], '->', a.out)
