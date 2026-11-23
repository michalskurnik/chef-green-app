"""Safe, scripted edits to a board template.

Usage inside a patch script (write the script to a file, then run it):

    import sys; sys.path.insert(0, '<skill>/scripts')
    from patch_util import Patch
    p = Patch('board.tpl.html', backup_tag='v12')   # copies to board.tpl.html.v12.bak first
    p.rep("old exact text", "new text")             # asserts the text occurs exactly once (count=1)
    p.rep("x", "y", count=3)                        # or exactly N times
    p.add_css('v12: compact toolbar', '.fbar{gap:8px}')
    p.save()                                        # nothing is written until save()

All checks run before save(), so a failed assertion never leaves a half-patched file.
"""
import shutil, os


class Patch:
    def __init__(self, path, backup_tag=None):
        self.path = path
        if backup_tag:
            shutil.copyfile(path, f'{path}.{backup_tag}.bak')
        with open(path, encoding='utf-8') as f:
            self.s = f.read()

    def rep(self, old, new, count=1):
        c = self.s.count(old)
        if c != count:
            raise AssertionError(f'expected {count} match(es), found {c}: {old[:90]!r}')
        self.s = self.s.replace(old, new)
        return self

    def rep_all(self, old, new):
        if old not in self.s:
            raise AssertionError(f'not found: {old[:90]!r}')
        self.s = self.s.replace(old, new)
        return self

    def insert_before(self, anchor, text, count=1):
        return self.rep(anchor, text + anchor, count)

    def add_css(self, label, css):
        """Append a commented CSS block at the end of the last <style> before the app script."""
        app = self.s.find('<script id="app">')
        head = self.s if app < 0 else self.s[:app]
        k = head.rfind('</style>')
        if k < 0:
            raise AssertionError('no </style> found before the app script')
        block = f'\n/* {label} */\n{css.strip()}\n'
        self.s = self.s[:k] + block + self.s[k:]
        return self

    def must_contain(self, *texts):
        for t in texts:
            if t not in self.s:
                raise AssertionError(f'missing after patch: {t[:90]!r}')
        return self

    def must_not_contain(self, *texts):
        for t in texts:
            if t in self.s:
                raise AssertionError(f'still present after patch: {t[:90]!r}')
        return self

    def save(self):
        tmp = self.path + '.tmp'
        with open(tmp, 'w', encoding='utf-8') as f:
            f.write(self.s)
        os.replace(tmp, self.path)
        print('patched', self.path, len(self.s), 'chars')
