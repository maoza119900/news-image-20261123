# THE WORLD TODAY — 23 November 2026

[![make.fun](https://img.shields.io/badge/make.fun-bounty-7c3aed)](https://make.fun)

A Node 22 program (standard library only) that draws a 1024×1024 newspaper
front page for Monday 23 November 2026 and writes it to
`$MAKEFUN_OUTPUT_DIR/entry.png`.

## Run

```sh
MAKEFUN_OUTPUT_DIR=out node main.ts
```

Two consecutive runs produce byte-identical output (same SHA-256). No network,
no external images, no `Date.now`, no `Math.random`.

## Page

Lead: NATO's extraordinary council meeting in Brussels over the Poland missile
incursion, with a hand-drawn map of the three impact sites. Plus the COP31
collapse, Iran's strike on Bahrain, the Dymer drone strike, the FT
chip-network investigation, the EU–Indonesia trade deal, and Bolsonaro in
intensive care. Every fact is sourced; items that were only reported are
labelled `REPORT:`.
