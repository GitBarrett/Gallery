# Legendary Shots — Design brief

## Direction: "Azeroth Night"
Dark, modern and dense like Maxroll, with a cinematic full-screen hero like Blizzard's official site. The screenshots are the hero; the UI stays in the background. **Dark theme only** (no light mode, no theme switch).

## Hard constraints
- **No Blizzard assets:** no logos, fonts, icons, sprites, sounds or texts from the game or Blizzard sites. Every WoW-like element below is drawn in-house.
- Exception: the official "Continue with Google" and Battle.net login logos (leave a placeholder).
- Footer notice: "World of Warcraft and Blizzard Entertainment are trademarks of Blizzard Entertainment, Inc. This site is not affiliated with or endorsed by Blizzard Entertainment."
- **Mobile first:** everything works at 360 px with no horizontal scroll; touch targets ≥ 44 × 44 px; nothing available only on hover.
- **WCAG AA:** text contrast ≥ 4.5:1 (≥ 3:1 above 24 px); input borders, focus rings and secondary button outlines ≥ 3:1 against their background.
- English UI by default; French strings run ~20 % longer, layouts must not break.

## Colour tokens

| Token | Value | Use |
|---|---|---|
| bg | #0B0E14 | Page background (deep night blue) |
| surface-1 | #10141D | Cards, panels |
| surface-2 | #161C29 | Raised elements, inputs, menus |
| border-subtle | #232A38 | Decorative card borders only |
| border-control | #5A6478 | Inputs, selects, secondary buttons (≥ 3:1) |
| text | #E6E9F0 | Body text |
| text-muted | #A9B1C2 | Secondary text |
| text-faint | #8C95A8 | Tertiary text (minimum allowed) |
| accent-gold | #E8B54A | Primary actions, links, active states |
| accent-arcane | #4FA3FF | Informational accents |
| success | #4ADE80 | Success messages (never the Uncommon green) |
| danger | #F26B6B | Errors, destructive actions |
| quest-yellow | gradient #FFF27A → #FFD100 → #FF7A00 | Quest markers, unread notifications |

**Quality tiers (reserved for captures only, never for avatars, notifications or success states):**

| Tier | Colour |
|---|---|
| Poor | #9D9D9D |
| Uncommon | #1EFF00 |
| Rare | #3D9BFF |
| Epic | #C77DFF |
| Legendary | #FF8000 |

The card frame and title of a capture take its tier colour, and the tier **name is always written** in the badge (colour is never the only signal).

## Typography
- Headings: **Cinzel** (600–700), letter-spacing 0.04–0.08em for display.
- Body and UI: **Inter** (400, 500, 600).
- Scale: 34 / 28 / 22 / 18 / 15 (body) / 13 (small). Mobile H1 ≤ 28.
- Captions in tooltips: italic, quest yellow (#FFD100).

## Spacing, radius, elevation
- 4-px base: 4, 8, 12, 16, 24, 32, 48, 64.
- Radius: 4 (badges, inputs), 6 (buttons, cards), 999 (pills).
- Thin gold borders and crisp corners for framed elements; shadows soft and dark.

## Components (one version each, used consistently)
- **Buttons:** three heights only — compact 36 (with a 44 px touch area), default 44, hero 52. Primary: gold fill, dark text. Secondary: transparent, border-control outline, light text. Ghost: text only. Destructive: danger.
- **Tabs:** a single style (pill) for version tabs, filters and periods.
- **CaptureCard:** one component with declared variants (grid, compact profile, leaderboard row, contest entry). Contains image (focal point crop, reserved size), title in tier colour, author, tier badge with name, like button (SVG heart) with count hidden under 10 and a "New" badge for captures under 7 days.
- **Quality badge:** dark pill (≥ 85 % opacity) with border, tier name + colour; tap/hover opens "Rare · 15+ likes · 12 likes to Epic".
- **Item tooltip:** night-blue background, silver border, title in tier colour, metadata lines, green "Use:" line, author caption in yellow italics. Used for capture metadata and reused for small bubbles.
- **Quest marker:** rounded "!" (new/contest/unread) and "?" (action/help) with the quest-yellow gradient and a soft glow; read state white → light grey.
- **Action-bar icons:** 68 px squares with a bevelled grey-metal frame, inner shadow, top highlight, coloured background and painted in-house pictograms (compass, quill, portal, chest, grimoire, astrolabe…). Provide a simplified version for 24–32 px.
- **Bottom sheet** (mobile), **modal** (desktop), **toast**, **banner**, **empty state** (illustration + sentence + one CTA).
- **Inputs:** 44 px high, border-control border, explicit placeholder colour (text-faint), error text under the field.

## Text on images (mandatory)
Never place text directly on a screenshot: always a scrim (gradient from #0B0E14 at 85–90 % behind the text to ~15 %) or a solid block. Text sits bottom-left on wide visuals (hero, banners), never centred. Badges on images: dark background ≥ 85 % + border.

## Logo
"Legendary Shots": in-house emblem (a legendary camera aperture inside a golden octagonal frame) + wordmark in Cinzel 700 caps, "Legendary" in #FF8000, "Shots" in #E8B54A. Horizontal and stacked versions, app icon.

## Layout
- Breakpoints: < 480, 480–767, 768–1023, 1024–1279, ≥ 1280.
- Masonry grid ordered by rows (newest first left to right): 2 columns with 8 px gutter on mobile, 3 / 4 / 5 columns on larger screens.
- Home: the first captures must appear early. Hero ≈ 560 px desktop / 56 svh mobile; version tabs on one scrollable line; Capture of the week can be the hero itself.
- Capture page mobile order: image → item tooltip → author → actions → comments → More from. Desktop: two columns (image left, tooltip + author + actions right).

## Mistakes to avoid (found in the first mock-ups)
1. No mobile layouts: design the 360 px versions first.
2. Quality colours reused for avatars, notifications and success: forbidden.
3. Hard-coded like thresholds in copy: always placeholders like `{rare}` likes.
4. Five different capture cards, six button heights, three tab styles: unify.
5. Pre-checked consent/rights checkbox: always unchecked.
6. Fake "Review" step in the upload stepper: either a real review step or no stepper.
7. Ads on sign-in/upload, or an ad between the image's tooltip and the author: forbidden.
8. Low-contrast input borders and small touch targets (22–40 px): ≥ 3:1 and ≥ 44 px.
9. Counters under 10 displayed ("♥ 7"): show "New" instead.
10. Game version lists that differ between pages: one admin-managed list.

## Tone of copy
Short, friendly, gamer wink without parody. Examples: "Quest log" for notifications, "Accept quest" to enter a contest, "Use Hearthstone" to go home from the 404, "You've seen everything" at the end of the grid, "Be the first to capture {version}".
