#!/usr/bin/env python3
"""One-shot P1-5 sweep: replace hand-rolled island button/input utility
strings with the shared .pb-btn / .pb-input classes (DESIGN-STANDARD §3.5).
Single-line class strings only; multi-line markup left for manual edits."""
import pathlib
import re
import sys

ROOT = pathlib.Path("src/islands")

BUTTONS = [
    (
        "inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-hover px-7 py-3 text-lg font-semibold text-white  transition-colors hover:opacity-90 sm:self-start",
        "pb-btn pb-btn-primary sm:self-start",
    ),
    (
        "inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-hover px-7 py-3 text-lg font-semibold text-white  transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-40 sm:self-start",
        "pb-btn pb-btn-primary sm:self-start",
    ),
    (
        "inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-hover px-7 py-3 text-lg font-semibold text-white  transition-colors hover:opacity-90 disabled:pointer-events-none disabled:opacity-40",
        "pb-btn pb-btn-primary",
    ),
    (
        "inline-flex min-h-12 items-center justify-center rounded-pill bg-primary-hover px-7 py-3 text-lg font-semibold text-white  transition-colors hover:opacity-90",
        "pb-btn pb-btn-primary",
    ),
    (
        "inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark sm:self-start",
        "pb-btn pb-btn-ink sm:self-start",
    ),
    (
        "inline-flex min-h-12 items-center justify-center rounded-pill bg-secondary px-7 py-3 text-lg font-semibold text-white  transition-colors hover:bg-secondary-dark",
        "pb-btn pb-btn-ink",
    ),
    (
        "inline-flex min-h-11 shrink-0 items-center justify-center rounded-pill bg-secondary px-5 text-small font-semibold text-white  transition-colors hover:bg-secondary-dark disabled:pointer-events-none disabled:opacity-40",
        "pb-btn pb-btn-ink pb-btn-sm shrink-0",
    ),
    (
        "inline-flex min-h-11 items-center justify-center rounded-pill bg-secondary px-5 py-2.5 text-small font-semibold text-white  transition-colors hover:bg-secondary-dark disabled:opacity-40",
        "pb-btn pb-btn-ink pb-btn-sm",
    ),
    (
        "inline-flex min-h-9 items-center justify-center rounded-pill bg-danger px-4 py-1.5 text-small font-semibold text-white transition-colors hover:bg-danger-dark",
        "pb-btn pb-btn-destructive pb-btn-sm",
    ),
    (
        "ml-auto rounded-pill border border-primary bg-transparent px-4 py-2 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15",
        "pb-btn pb-btn-ghost pb-btn-pill pb-btn-sm ml-auto",
    ),
    (
        "inline-flex min-h-12 items-center justify-center rounded-pill border border-primary bg-transparent px-6 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15",
        "pb-btn pb-btn-ghost pb-btn-pill",
    ),
    (
        "inline-flex min-h-11 items-center justify-center rounded-pill border border-primary bg-transparent px-5 text-small font-semibold text-primary-strong transition-colors hover:bg-primary/15",
        "pb-btn pb-btn-ghost pb-btn-pill pb-btn-sm",
    ),
]

# Inputs: everything from `rounded-md border` up to and including
# `focus:ring-2 focus:ring-ink` inside a className becomes the pb-input core;
# surrounding layout/typography utilities are kept.
INPUT_RE = re.compile(
    r'className="(?P<pre>[^"]*?)rounded-md border[^"]*?focus:ring-2 focus:ring-ink(?P<post>[^"]*)"'
)


def clean(text: str) -> str:
    for old, new in BUTTONS:
        text = text.replace(old, new)
    text = INPUT_RE.sub(
        lambda m: 'className="pb-input %s %s"' % (m.group("pre").strip(), m.group("post").strip()),
        text,
    )
    return re.sub(r'\s{2,}', ' ', text)


changed = []
for path in sorted(ROOT.rglob("*.tsx")):
    before = path.read_text(encoding="utf-8")
    after = clean(before)
    if after != before:
        path.write_text(after, encoding="utf-8")
        changed.append(str(path))

print(f"changed {len(changed)} files")
for name in changed:
    print(" ", name)
