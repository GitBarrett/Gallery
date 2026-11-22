# Legendary Shots — Screen inventory

Design every screen **mobile (360–390 px) first**, then desktop (1440 px). Priority 1 screens first. "States" are variants of the same screen to design as well.

## Priority 1 — core MVP journeys

| # | Screen | Route | Key content | States to design |
|---|---|---|---|---|
| 1 | Home | `/` | Full-screen hero (community capture, gradient, title, CTAs bottom-left, author credit), version tabs, Capture of the week, latest captures masonry grid | Visitor, member, nearly empty (launch) |
| 2 | Version page (PLP) | `/v/{version}` | Breadcrumb, version title, filter bar (zone, time of day, minimum quality with "?", sort), masonry grid, infinite scroll | Filters applied, empty version, end of list, mobile filters bottom sheet |
| 3 | Capture page (PDP) | `/p/{id}-{slug}` | Large image, item tooltip, author block with social links, actions (Like, Download, Share, Report), comments, "More from {author}" | Visitor / member / owner, sticky mobile action bar, fallbacks of "More from", 0 comments, under review (owner only) |
| 4 | Full-screen viewer | overlay | Image only, zoom, previous/next, close | Mobile swipe + pinch-zoom |
| 5 | Upload | `/upload` | Drop zone / photo library picker, form (title, version, zone autocomplete, tags, metadata, caption, alt text, rights checkbox), live card + tooltip preview, focal point | Empty, file selected, converting, uploading with progress, error variants (format, size, dimensions, quota, conversion failed on mobile), success, under review |
| 6 | Sign in | `/signin` | Continue with Google, Continue with Battle.net, email + password, Forgot password? | Wrong credentials, bot check shown, locked 1 h |
| 7 | Sign up | `/signup` | OAuth buttons, email, username (live availability), password (show/hide), required 15+/Terms checkbox | Username taken/reserved, breached password, invitation-only (waiting list) |
| 8 | Complete profile (after OAuth) | `/signup/complete` | Username + Terms checkbox | Link to existing account |
| 9 | Search results | `/search?q=` | Query, suggestions, result grid, sort | Typo corrected ("Showing results for…"), no results with suggestions |
| 10 | Public profile | `/u/{username}` | Avatar, username, bio, social links (monochrome icons), stats, badges/titles, captures grid | Visitor view, own view (edit, statuses, progress to next tier), empty (own / others) |
| 11 | Quest log (notifications) | `/notifications` + bell dropdown | Grouped Today/Earlier, unread yellow with "!" marker, read grey, Mark all as read | Empty, many items, moderation decision with reason |
| 12 | Mobile tab bar + headers | global | Tab bar (Explore, Search, Upload centre, Notifications, Profile); header desktop / tablet icons / mobile compact / transparent over hero | Hidden on scroll, offline banner |

## Priority 2 — rest of MVP

| # | Screen | Route | Notes |
|---|---|---|---|
| 13 | Account settings | `/settings` | Sections: profile (avatar crop, bio, social links), language, email, password, linked accounts, notification preferences, devices, delete account |
| 14 | Social links editor | `/settings#social` | 9 networks, handle-only inputs with per-network validation, website https |
| 15 | Delete account flow | `/settings` modal | Confirm, scheduled (30 days), cancel |
| 16 | Forgot / reset password | `/reset` | Request, check inbox, new password, expired link |
| 17 | Verify email | `/verify` | Success, expired + resend, "Verify your email" banner on blocked actions |
| 18 | Staff 2FA | `/signin/2fa` | Code entry, setup with QR + 10 backup codes |
| 19 | Report content modal | overlay | Reasons list + comment, visitor prompt, confirmation |
| 20 | Share menu | overlay | Copy link, X, Facebook, Reddit, Discord (desktop); native sheet (mobile) |
| 21 | Quality tooltip + badge popover | overlay / bottom sheet | 5 tiers with current thresholds, "Rare · 15+ likes · 12 likes to Epic" |
| 22 | How quality works | `/help/quality` | Explanation, thresholds, how likes count |
| 23 | Bug report modal | overlay + `/report` | Category, description, screenshot, success with reference, rate-limited |
| 24 | Cookie consent | panel + settings page | Accept all / Reject all / Customise equal weight |
| 25 | Install prompts | banner + iOS sheet | After 2nd visit |
| 26 | Offline page + update toast | `/offline`, toast | |
| 27 | 404 (uncharted zone) | any unknown URL | Treasure-map illustration, "Use Hearthstone" button, search |
| 28 | 500 | errors | Error reference, retry |
| 29 | Waiting list (closed beta) | `/signup` | Email form, confirmation |
| 30 | Legal pages | `/legal`, `/terms`, `/privacy` | Long-form reading layout |
| 31 | Admin — moderation queue | `/admin/moderation` | Table/list, filters, item review panel with scores and reports, publish/hide/delete with reason, sanction modal |
| 32 | Admin — site settings | `/admin/settings` | Quality and moderation thresholds, hero picker (with contrast check), editor's pick, feature switches |
| 33 | Admin — versions, zones, invitations, roles, audit | `/admin/*` | CRUD lists, merge zone flow, invite + waiting list, audit filters |

## Priority 3 — Later (hidden at launch, design now so they slot in)

| # | Screen | Notes |
|---|---|---|
| 34 | Leaderboard | Period/version filters, podium (mobile carousel), ranks 4–50, "Your best this week", warming-up gauge |
| 35 | Contests list + contest page | States: scheduled, open, extended, judging, closed (podium / no podium), cancelled; entry picker modal |
| 36 | Following feed | Empty: 6 suggested photographers |
| 37 | Collections | Add-to-collection modal, collection page (public/private) |
| 38 | Support | `/support`, thank you, pending, cancelled, Supporter badge, donation history |
| 39 | Easter eggs | Loot-roll modal, "Stop poking me!" bubble, anniversary banner |
| 40 | Secret quest | Clue panel, answer prompt, completion + badge reveal, Hall of Seekers, admin quests |
| 41 | Ad slots | Footer banner (728×90 desktop / 320×50 mobile), in-grid native slot full width between grid blocks, side slot on capture page under "More from" (desktop ≥ 1280 px); always labelled "Advertisement"; never on hero, sign-in, upload, settings |
