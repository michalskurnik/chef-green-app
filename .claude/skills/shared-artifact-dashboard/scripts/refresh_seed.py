"""Refresh the data copy embedded in an already published board page, without its template.

    python3 refresh_seed.py <page.html> <dump_dir> <out.html> [--collections items,releases,log,projects]

<page.html>  the live page, from `Artifact read url:<board> path:"index.html"` (the platform wrapper is fine).
<dump_dir>   a fresh dump: `ArtifactData list ... out_dir:<dump_dir>` for every collection.
<out.html>   publish this with `Artifact publish url:<board> file_path:<out.html>`, then run
             check_copy_vs_db.py on the re-read live page.

For sessions that only update tickets (no template, no build setup): the page code stays exactly as published,
only the JSON inside <script type="application/json" id="seed"> is replaced. Fails loudly if that block
is missing or appears more than once.
"""
import argparse, datetime, json, os, re, sys

ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('dump'); ap.add_argument('out')
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


cols = a.collections.split(',')
missing = [c for c in ('items', 'releases') if c in cols and not os.path.isdir(os.path.join(a.dump, c))]
if missing:
    sys.exit(f'dump is missing {missing}: dump every collection before refreshing the page')
now = datetime.datetime.now(datetime.timezone.utc)
seed = {c: load(c) for c in cols}
seed['at'] = now.strftime('%d/%m %H:%M') + ' UTC'
seed['atIso'] = now.strftime('%Y-%m-%dT%H:%M:%S.000Z')
js = json.dumps(seed, ensure_ascii=False).replace('</', '<\\/')

with open(a.page, encoding='utf-8') as fh:
    s = fh.read()
# the page's own code contains the opening tag inside a JS string (self-republish), so only a block whose
# content is a JSON object counts; the seed escapes '</', so its first '</script>' is the real end
pat = re.compile(r'(<script type="application/json" id="seed">)(\{.*?)(</script>)', re.S)
found = pat.findall(s)
if len(found) != 1:
    sys.exit(f'expected exactly one seed block in {a.page}, found {len(found)}')
s = pat.sub(lambda m: m.group(1) + js + m.group(3), s, count=1)
with open(a.out, 'w', encoding='utf-8') as fh:
    fh.write(s)
print(' '.join(f'{c}={len(seed[c])}' for c in cols), 'at', seed['atIso'], '->', a.out)
