# Story card text and elements

The Facebook story image is built from `buildRenderedCardSvg` in `lib/automation.ts`. It shows:

## Layout

- **Full-screen artwork** (1080×1920) from the match’s generated artwork asset.
- **Dark gradient overlay** at the bottom so text stays readable.
- **Text blocks** (see below). These must be rendered as vector paths (not `<text>`) so they appear correctly in serverless (no system fonts). That’s done in `lib/text-to-path.ts` using the bundled Noto Sans font.

## Intended text (prediction card)

| Line | Content | Example |
|------|---------|--------|
| 1 | Headline | **Who's gonna win?** |
| 2 | Team 1 name | e.g. Melbourne City FC Women |
| 3 | Team 2 name | e.g. Adelaide United Women |
| 4 | Match date/time (yellow) | e.g. 3/19/2026, 10:00:00 AM |
| 5 | Vote percentages | e.g. 45% vs 55% backing |
| 6 | Sport + CTA | e.g. Football · Tap to vote |

## Intended text (result card)

| Line | Content | Example |
|------|---------|--------|
| 1 | Headline | **Who won?** |
| 2 | Score (yellow) | e.g. 2–1 or FT |
| 3 | Team 1 name | |
| 4 | Team 2 name | |
| 5 | Percentages + total votes | e.g. 45% vs 55% · 120 votes |
| 6 | Sport · league | e.g. Football · A-League |

## Why text can appear as boxes

If you see **tofu (empty boxes)** instead of letters, the SVG was converted to PNG **without** turning `<text>` into `<path>`. That happens when:

1. **Font not found** – The serverless runtime couldn’t load the bundled font (`lib/fonts/NotoSans-Regular.ttf` or `public/fonts/NotoSans-Regular.ttf`), so `replaceTextWithPaths` is skipped and the SVG still has `<text>` with `font-family="Liberation Sans, Arial, ..."`. Those fonts aren’t on Vercel, so librsvg draws missing-glyph boxes.
2. **Text-to-path failed** – If `replaceTextWithPaths` throws (e.g. bad SVG), the route falls back to the original SVG and the same missing-font behavior occurs.

Fix: ensure the Noto font file is in the repo and that the font path used at runtime (see `lib/text-to-path.ts`) resolves on Vercel (e.g. `process.cwd() + '/public/fonts/NotoSans-Regular.ttf'` or `.../lib/fonts/...`).
