"""Check that a page's embedded copy (seed) matches the database exactly.

    python3 check_copy_vs_db.py <page.html> <fresh_dump_dir> [--collections items,releases,log,projects]

<page.html> is the live index.html saved by `Artifact read path:index.html` (or a build).
<fresh_dump_dir> is a dump taken AFTER the last database write (ArtifactData list ... out_dir).
Reports, per collection: documents in the database missing from the page copy, documents whose
content differs (and which side is newer), and documents in the page copy that are no longer in the
database. Exit 1 on any mismatch.

Why: if a viewer's live connection fails or delivers an old saved copy, the board shows its embedded
copy. Keeping "page copy == database" after every change made by Claude means such a viewer still
sees current data, and a mismatch is caught before telling the user anything is done.
"""
import re, json, glob, os, sys, argparse

ap = argparse.ArgumentParser()
ap.add_argument('page'); ap.add_argument('dump')
ap.add_argument('--collections', default='items,releases,log,projects')
a = ap.parse_args()
s = open(a.page, encoding='utf-8').read()
m = re.search(r'<script type="application/json" id="seed">(\{.*?)</script>', s, re.S)
if not m:
    sys.exit('no seed script found in ' + a.page)
seed = json.loads(m.group(1).replace('<\\/', '</'))
clean = lambda d: {k: v for k, v in d.items() if not k.startswith('_') and k != 'id'}
bad = 0
for col in a.collections.split(','):
    S = {x['id']: clean(x) for x in seed.get(col, [])}
    D = {}
    for f in glob.glob(os.path.join(a.dump, col, '*.json')):
        D[os.path.basename(f)[:-5]] = clean(json.load(open(f, encoding='utf-8')))
    D_all = dict(D)
    if col == 'log' and len(S) < len(D):
        # the page keeps only the newest log entries; compare that window
        newest = sorted(D, key=lambda k: str(D[k].get('at', '')))[-len(S):] if S else []
        D = {k: D[k] for k in newest}
    missing = [k for k in D if k not in S]
    extra = [k for k in S if k not in D_all]
    differ = []
    for k in D:
        if k in S and S[k] != D[k]:
            t_db, t_pg = str(D[k].get('updatedAt', D[k].get('at', ''))), str(S[k].get('updatedAt', S[k].get('at', '')))
            fields = sorted(f for f in set(S[k]) | set(D[k]) if S[k].get(f) != D[k].get(f))
            differ.append(f"{k} [{', '.join(fields)}] db {t_db} vs page {t_pg}")
    n = len(missing) + len(extra) + len(differ)
    bad += n
    print(f'{col}: db {len(D)} page {len(S)} | missing in page: {missing} | not in db: {extra} | different: {differ}')
print('RESULT:', 'page copy matches the database' if not bad else f'{bad} mismatch(es): rebuild from a fresh dump and republish')
sys.exit(1 if bad else 0)
