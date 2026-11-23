"""Validate a board's data dump against the board's own rules (enums read from the template).

    python3 validate_data.py <template.html> <dump_dir> [--server-times <list.json>]

Checks every item, release, log entry and project:
- enum fields hold values the board knows (type, status, sev, owner, pkg, source; release status)
- each item's release exists (or is empty), its project exists, num is a positive integer, unique per project
- log entries: valid project, item log keys match the item's current key (SYM-num), itemId exists or was deleted (logged)
- timestamps: ISO format, not in the future, updatedAt >= createdAt
- writes from outside the page (no 'by', or who not a known name) are listed for review
Exit code 1 when an ERROR is found; WARN lines are worth a look but do not fail.
"""
import json, os, re, sys, glob, datetime

tpl_path, dump = sys.argv[1], sys.argv[2]
tpl = open(tpl_path, encoding='utf-8').read()


def js_map(name):
    m = re.search(r'var ' + name + r'=\{(.*?)\};', tpl)
    if not m:
        return {}
    out = {}
    for k, v in re.findall(r"(?:'([^']*)'|([A-Za-z0-9_]+))\s*:\s*'([^']*)'", m.group(1)) and [
            ((a or b), c) for a, b, c in re.findall(r"(?:'([^']*)'|([A-Za-z0-9_]+))\s*:\s*'([^']*)'", m.group(1))]:
        out[k] = v
    return out


E = {n: js_map(n) for n in ['TYPE', 'SEV', 'ST', 'PKG', 'SRC', 'OWN', 'RST']}
p0 = re.search(r"var PROJ0=\{id:'([^']+)',name:'([^']*)',symbol:'([^']+)'", tpl)
PROJ0 = {'id': p0.group(1), 'name': p0.group(2), 'symbol': p0.group(3)} if p0 else {'id': 'gc', 'symbol': 'GC'}


def load(col):
    out = {}
    for f in glob.glob(os.path.join(dump, col, '*.json')):
        o = json.load(open(f, encoding='utf-8')); o['id'] = os.path.basename(f)[:-5]; out[o['id']] = o
    return out


items, rels, logs, projs = load('items'), load('releases'), load('log'), load('projects')
projects = {PROJ0['id']: PROJ0}; projects.update(projs)
errs, warns = [], []
now = datetime.datetime.now(datetime.timezone.utc)
ISO = re.compile(r'^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z$')


def ts(v, where):
    if v in (None, ''):
        return None
    if not ISO.match(str(v)):
        errs.append(f'{where}: timestamp not ISO-UTC: {v!r}'); return None
    t = datetime.datetime.fromisoformat(str(v).replace('Z', '+00:00'))
    if t > now + datetime.timedelta(minutes=5):
        errs.append(f'{where}: timestamp in the future: {v}')
    return t


def proj(x):
    return x.get('project') or PROJ0['id']


def key(i):
    return projects.get(proj(i), PROJ0).get('symbol', 'GC') + '-' + str(i.get('num'))


nums = {}
for i in items.values():
    w = f"item {i['id']} ({key(i)})"
    for f, m in [('type', 'TYPE'), ('status', 'ST'), ('owner', 'OWN'), ('pkg', 'PKG'), ('source', 'SRC')]:
        if i.get(f) not in (None, '') and E[m] and i[f] not in E[m]:
            errs.append(f'{w}: {f}={i[f]!r} is not one of {sorted(E[m])}')
    if i.get('sev') not in (None, '') and E['SEV'] and str(i['sev']) not in E['SEV']:
        errs.append(f"{w}: sev={i['sev']!r} is not one of {sorted(E['SEV'])}")
    if proj(i) not in projects:
        errs.append(f'{w}: project {proj(i)!r} does not exist')
    r = i.get('release') or ''
    if r and r not in rels:
        errs.append(f'{w}: release {r!r} does not exist')
    elif r and proj(rels[r]) != proj(i):
        errs.append(f'{w}: release {r!r} belongs to project {proj(rels[r])!r}')
    n = i.get('num')
    if not isinstance(n, int) or n < 1:
        errs.append(f'{w}: num {n!r} is not a positive integer')
    else:
        nums.setdefault((proj(i), n), []).append(i['id'])
    c, u = ts(i.get('createdAt'), w + ' createdAt'), ts(i.get('updatedAt'), w + ' updatedAt')
    if c and u and u < c:
        errs.append(f'{w}: updatedAt before createdAt')
    if not str(i.get('title', '')).strip():
        errs.append(f'{w}: empty title')
for (pj, n), ids in nums.items():
    if len(ids) > 1:
        errs.append(f'number {pj}:{n} used by {len(ids)} items: {ids}')
for r in rels.values():
    w = f"release {r['id']}"
    if E['RST'] and r.get('status') not in E['RST']:
        errs.append(f"{w}: status {r.get('status')!r} is not one of {sorted(E['RST'])}")
    if proj(r) not in projects:
        errs.append(f'{w}: project {proj(r)!r} does not exist')
    ts(r.get('updatedAt'), w + ' updatedAt')
deleted = {e.get('itemId') for e in logs.values() if e.get('col') == 'items' and str(e.get('action', '')).startswith('נמחק')}
names = set(E['OWN'].values()) | {'Claude'}
for e in logs.values():
    w = f"log {e['id']}"
    ts(e.get('at'), w + ' at')
    if e.get('project') and e['project'] not in projects:
        errs.append(f"{w}: project {e['project']!r} does not exist")
    if e.get('col') == 'items':
        it = items.get(e.get('itemId'))
        if not it and e.get('itemId') not in deleted:
            warns.append(f"{w}: item {e.get('itemId')} not found and no delete logged")
        if it and e.get('key') and e['key'] != key(it):
            warns.append(f"{w}: key {e['key']} but the item is now {key(it)}")
    if not e.get('by'):
        warns.append(f"{w}: written without a user id (who={e.get('who')!r}, at={e.get('at')}) - written outside the page or by an old version")
for k, v in [('items', items), ('releases', rels), ('log', logs), ('projects', projs)]:
    print(f'{k}: {len(v)}')
for m in errs:
    print('ERROR', m)
for m in warns:
    print('WARN ', m)
print('RESULT:', 'ERRORS FOUND' if errs else 'no errors', f'({len(errs)} errors, {len(warns)} warnings)')
sys.exit(1 if errs else 0)
