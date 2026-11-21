# Potluck design brief

Visual direction for Potluck (potluck.mrandrewshub.com), the project-based-learning app in Mr. Andrew's Hub. Chosen direction: picnic cloth base with sticker-style cards ("7 · Piknik + matrica" on the design canvas). The saved HTML mockup is the reference; this file states the rules behind it.

Potluck has its own look. It does not use the Hub's chalkboard palette or fonts.

## Idea

A potluck table: everyone brings something, and you can see who brought what. Warm picnic colours carry the mood; thick outlines and hard shadows make cards and buttons feel like stickers you can pick up.

## Colours

| Token | Hex | Use |
|---|---|---|
| `cream` | `#FFF8EC` | Page background, small pills |
| `white` | `#FFFFFF` | Card background, open task row |
| `ink` | `#3B2A20` | Text, every outline, every shadow |
| `ink-soft` | `#5A463A` | Secondary text |
| `tomato` | `#C4321F` | Brand colour: logo sticker, primary button, highlighted words |
| `tomato-deep` | `#8F2315` | Links, small red text on light backgrounds |
| `lettuce` | `#BFE3A8` | Task row: done |
| `butter` | `#FFE9B8` | Task row: claimed |
| `honey` | `#FFD98A` | Group pill, small tags |

Rules:

- White text on `tomato` passes contrast (about 5.5:1). Do not lighten `tomato`.
- `tomato` as text on `cream` is for headline-size words only; for small red text use `tomato-deep`.
- Text on `lettuce`, `butter` and `honey` is always `ink`.
- No gradients except the gingham pattern. No soft or blurred shadows.

## Type

Google Fonts, loaded with:

```html
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet">
```

| Role | Font | Mockup values |
|---|---|---|
| Display | Baloo 2, 800 | Hero h1 36px / 1.05; card title 22px / 1.15; logo 27px; primary button 20px |
| Body | Nunito, 600 | 16px / 1.5, colour `ink-soft` |
| UI labels | Nunito, 800–900 | Task text 15px/800; names 13px/900; pills 12px/900; small button 14px/900 |
| Note | Nunito, 700 | 13px, colour `ink-soft` |

Fallback stack for both: `system-ui, sans-serif`.

One phrase per headline is coloured `tomato` (in the hero: "everyone brings"). No second font for emphasis.

## Outline and shadow

This is what makes the look. Apply it consistently.

| Element | Border | Radius | Shadow |
|---|---|---|---|
| Card | 3px solid `ink` | 20px | `6px 6px 0` `ink` |
| Primary button | 3px solid `ink` | 16px | `4px 4px 0` `ink` |
| Logo sticker | 3px solid `ink` | 14px | `4px 4px 0` `ink` |
| Task row | 3px solid `ink` (dashed when open) | 14px | none |
| Small button in a row | 3px solid `ink` | 12px | none |
| Pill / tag | 2–3px solid `ink` | 999px | none |

- Shadows are hard offsets, zero blur, always `ink`, always down-right.
- Only top-level objects get a shadow (card, primary button, logo). Items inside a card do not.
- Leave room on the right and bottom for the shadow (the mockup card has 22px left margin and 26px right).
- Suggested pressed state for buttons (not in the mockup): move the element 2px down-right and shrink the shadow by 2px.

## Gingham header

The top band is red-and-white gingham, 96px tall on mobile, with a 3px `ink` bottom border.

```css
background-color: #FFFFFF;
background-image:
  linear-gradient(90deg, rgba(196,50,31,0.55) 50%, rgba(196,50,31,0) 50%),
  linear-gradient(rgba(196,50,31,0.55) 50%, rgba(196,50,31,0) 50%);
background-size: 32px 32px;
```

Use gingham only for the header band (and at most one other accent area per page). Never put text directly on it: text sits on a sticker or pill.

## Logo sticker

"Potluck" in Baloo 2 800, white on `tomato`, 3px `ink` border, radius 14px, hard shadow, rotated -3deg, padding 2px 16px. Next to it, right-aligned: a `cream` pill with 2px `ink` border reading "by Mr. Andrew's Hub" (Nunito 800, 12px).

## Task row states

Each row: status circle (26px), task text, then owner name or action button. Minimum height 48px, padding 6px 10px, gap 10px.

| State | Row background | Row border | Status circle | Right side |
|---|---|---|---|---|
| Done | `lettuce` | solid | `ink` filled, white check icon | Owner name |
| Claimed | `butter` | solid | white, 3px solid `ink` ring | Owner name |
| Open | `white` | dashed | empty, 3px dashed `ink` ring | "I'll bring it" button (`tomato`, white text, 44px tall) |

State is always shown by circle and border style as well as colour, so it reads without colour.

## Card

White, outlined and shadowed as above, padding 16px, 10px gap between rows. Header row: project title (Baloo 2 800, 22px) on the left, group pill (`honey`) on the right.

## Layout

- Mobile first: the mockup is 390px wide; side padding 22px.
- Hero order: headline, one supporting sentence, primary button (54px tall, full width), one-line note under it.
- Touch targets at least 44px tall.
- Icons: simple stroke SVG in `ink` or white, rounded caps. No emoji.

## Copy

Language: English. Voice: teacher to teacher, short and concrete, playful but not childish, no marketing words. Sentence case everywhere, buttons start with a verb.

- Hero: "Group projects where everyone brings something."
- Sub: "Pick a classroom-tested project. AI fits it to your class. Then one board runs it all."
- Primary button: "Pick a project"
- Note: "No student accounts. Just a code and a nickname."
- Claim button: "I'll bring it"

Keep the potluck metaphor to headlines and small touches ("on the table", "I'll bring it"). Interface terms stay plain: task, milestone, rubric.

## Not decided yet

- Everything beyond the hero and one board card: teacher monitor, milestone hand-in, assessment screens, desktop layout.
- Hover, focus and disabled states; error and empty states.
- A standalone logo file and favicon.
- The sample content in the mockup (The Anti-guidebook, Group 3, Mia, Leo, the three tasks) is placeholder.
