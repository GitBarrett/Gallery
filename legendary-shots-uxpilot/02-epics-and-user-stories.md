# Legendary Shots — Product pitch

**Tagline:** Azeroth, seen by its players.

## The problem
World of Warcraft Forever shipped a rebuilt graphics engine, and players take more screenshots than ever. Those captures end up scattered across Discord, Reddit and X, compressed, uncredited and impossible to find a week later. No modern site is dedicated to showcasing them.

## The product
Legendary Shots is a community gallery where WoW players publish, discover, like and download in-game screenshots in full resolution (up to 8K), organised by game version.

What makes it different:
- **Every capture tells its story.** Under each image, an "item tooltip" shows where and how it was taken: zone, in-game time, graphics settings, character, and the author's caption, styled like a WoW item tooltip.
- **Captures earn a quality tier through likes**, like WoW item rarity: Poor (grey), Uncommon (green), Rare (blue), Epic (purple), Legendary (orange).
- **Full-resolution downloads** for wallpapers, metadata stripped, colours untouched.
- **Organised by game version** (WoW Forever, Retail, Classic Era, Classic progression…), searchable by zone in English and French ("Stormwind" = "Hurlevent").
- **Community life:** comments, notifications as a "Quest log", later weekly leaderboards, themed contests, collections and follows.
- **Playful secrets:** a custom 404 ("You have wandered into an uncharted zone"), later a Konami-code loot roll and a seasonal hidden quest with clues.

## Audience
- WoW players of every version who take screenshots, especially WoW Forever players.
- Virtual photographers who carefully compose shots.
- Content creators (streamers, YouTubers) looking for visuals and exposure; profiles link to their Twitch, YouTube and other socials.

## Product principles
1. **The captures are the hero.** The interface stays dark and quiet so screenshots shine.
2. **Feels like WoW, without copying Blizzard.** Item tooltips, quest markers, rarity colours and action-bar icons are all redrawn in-house. No Blizzard logo, font, icon, sound or asset.
3. **Mobile first.** Every screen works at 360 px wide; it is an installable PWA.
4. **Never empty.** At launch the site is nearly empty: every block has a fallback instead of a "0" or a blank space.
5. **Accessible.** WCAG AA contrast, full keyboard navigation, reduced-motion support, quality never conveyed by colour alone.
6. **Bilingual.** English by default, French available.

## Business model
Free. Funded later by advertising (clearly labelled, never above a capture, never on sign-in, upload or settings) and optional one-off donations (no perks that affect rankings).

## Launch plan
Closed beta by invitation (20 to 30 photographers, 200+ captures), then public opening.

## Benchmarks
ArtStation (dark, art at large size, challenges), Unsplash (one-click HD download, fluid masonry grid), DeviantArt (collections, profiles, follows), Flickr (tags, search). Visual references: Maxroll and Mamytwink (dense, dark, gaming), Blizzard's official site (cinematic hero).



# Legendary Shots — Epics and user stories (UX view)

Scope tags: **[MVP]** = first release (closed beta, then public); **[Later]** = planned after launch, screens hidden behind a feature switch until then. Each story lists the screens it touches (see `03-screen-inventory.md`). Technical and security rules are omitted unless they change what the user sees.

| Epic | Goal | Scope |
|---|---|---|
| E1 Accounts | Sign up, sign in, manage one's account and public profile | MVP |
| E2 Publishing | Upload a capture with its story | MVP |
| E3 Discovery | Browse, search, view, download, share | MVP (leaderboard Later) |
| E4 Community | Like, comment, be notified (follows, collections, digest Later) | MVP + Later |
| E5 Contests | Themed contests with live ranking and rewards | Later |
| E6 Moderation and admin | Keep the community healthy, run the site | MVP |
| E7 Platform | Languages, mobile, PWA, offline, cookies, errors, legal, accessibility | MVP |
| E8 Quality and cold start | Make the quality tiers understandable, never show empty blocks | MVP |
| E9 Support | One-off donations | Later |
| E10 Secrets | Easter eggs and a hidden quest | MVP (404) + Later |

---

## E1 — Accounts

### 1.1 [MVP] Sign up with email
As a visitor, I want to create an account so I can publish captures.
- Fields: email, username (3–24 chars, letters, digits, `_` `-`), password (10–128 chars, shown/hidden toggle), required checkbox "I am at least 15 and accept the Terms and Privacy policy", invisible bot check.
- Username availability shown live (< 0.5 s): available / taken / reserved / inappropriate.
- A password found in known data breaches is refused with a clear message.
- After sign-up: signed in, banner "Verify your email" with a resend button (max 3 per hour). The verification link opens the profile.
- If the email is already used, the same neutral "Check your inbox" message is shown.
- Screens: Sign up, Verify email (success, expired link + Resend).

### 1.2 [MVP] Continue with Google or Battle.net
- Buttons "Continue with Google" and "Continue with Battle.net" (official logos only, on top of the email form).
- First time: an extra step "Choose your username + accept Terms (15+)" before the account exists.
- If the provider email matches an existing account: no silent merge; the user signs in to the existing account to confirm linking.
- Provider error or cancel: translated message and retry.
- Battle.net gives no email: email verification is asked before the first upload.
- Screens: Sign in (OAuth buttons), Complete your profile (OAuth step), Link accounts confirmation, OAuth error.

### 1.3 [MVP] Sign in, sign out
- Same error message whether the email exists or not.
- After 5 failures: a bot check appears; after 20 in an hour: password sign-in locked for 1 hour (message with time).
- Sign out from the avatar menu; signed-in sessions last 30 days.
- Staff (moderators, admins) must enter a 6-digit authenticator code (or a backup code) before reaching the admin area; first time, they set it up (QR code + 10 backup codes shown once).
- Screens: Sign in, Locked account message, Staff 2FA code, Staff 2FA setup.

### 1.4 [MVP] Forgot password
- Enter email → same confirmation whatever the case. Link valid 1 hour; expired/used link → message + restart. After reset, all other devices are signed out.
- Screens: Forgot password, Check your inbox, Choose a new password, Link expired.

### 1.5 [MVP] Username and public profile
- Public profile `/u/{username}`: avatar, bio, social links, stats (captures, likes received; counters under 10 hidden), grid of published captures, badges and titles (Later: collections, followers, Follow button).
- Own profile shows extra: "Edit profile", captures awaiting review or rejected (with status), progress toward the next quality tier on each capture.
- Empty profile: own → message + Upload button; others → "No captures yet".
- Username can change once every 30 days; old URL redirects for 90 days.
- Screens: Profile (visitor view), Profile (own view), Profile empty states.

### 1.6 [MVP] Account settings
- Sections: Profile (avatar with square crop, bio ≤ 300 chars, social links), Language, Email (change needs password + confirmation link), Password, Linked accounts (Google, Battle.net; cannot unlink the last sign-in method), Notification preferences (likes, comments, followers, contests; moderation decisions always on), Devices/sessions, Delete account. Later: donation history, data export.
- New avatar stays "under review" (old one shown) until automatic moderation approves it.
- Screens: Settings (each section), Avatar crop modal, Delete account confirmation.

### 1.7 [MVP] Social links on the profile
- In settings, choose from a fixed list: Twitch, YouTube, X, Bluesky, Instagram, TikTok, Reddit, Discord, Website. The user types only the handle (e.g. `luneblade`), never a full URL; per-network format check with a precise error.
- Website: `https://` only, the profile shows the domain only.
- On the profile: one monochrome in-house icon per network under the bio, opening the network in a new tab; Discord has no link, a button copies the handle.
- Links hidden on accounts less than 7 days old or sanctioned (anti-spam).
- Screens: Settings › Social links, Profile header with links.

### 1.8 [MVP] Email verification before publishing
- Unverified members can browse, like and follow, but uploading, commenting and joining contests show a "Verify your email" banner with a resend button.

### 1.9 [MVP] Delete my account
- Confirm with password (or re-authenticate with the provider). Account hidden immediately, user signed out, email with a cancel link; everything deleted after 30 days; cancel within 30 days restores everything.
- Screens: Delete account flow, Deletion scheduled confirmation, Cancel deletion.

---

## E2 — Publishing

### 2.1 [MVP] Upload a capture
As a verified member, I want to publish a screenshot.
- Accepted: JPEG, PNG, WebP, TGA; up to 20 MB; 640 to 7680 px on the long side; up to 8K (7680 × 4320).
- Drag and drop or file picker (on mobile: photo library). Instant client-side check with the precise reason when refused (format, size, dimensions).
- Files over 20 MB (big PNG/TGA) are converted in the browser: first losslessly (no warning), and only if still too large, to high-quality JPEG with a warning about the slight loss. On mobile, if conversion runs out of memory: "Convert this file on a computer".
- Upload progress bar with resume after a network drop.
- Limit: 20 uploads per 24 h; the 21st shows when the user can upload again.
- After sending: status "Processing" → "Published" / "Under review" / "Rejected" (notification).
- Screens: Upload (empty), Upload (file selected + form), Upload converting, Upload in progress, Upload errors (format, size, dimensions, quota, duplicate), Upload success, Upload "under review".

### 2.2 [MVP] Metadata, zone and tags
- Required: title (≤ 100 chars), game version (single choice from an admin-managed list).
- Optional: description, zone (autocomplete in EN and FR: typing "Hurl" or "Stormw" suggests "Stormwind City / Hurlevent"; free text allowed and reviewed later), up to 10 tags with suggestions, in-game time, graphics settings, character, caption (shown in yellow italics in the tooltip), alt text (≤ 150 chars).
- Live preview of the card and its item tooltip as the user types; a note explains that every capture starts at Poor and climbs with likes.
- Checkbox (unchecked by default) "I took this capture myself" with a link to the licence terms.

### 2.3 [MVP] Focal point
- On the preview, tap/click a point to set the focal point used for crops (grid thumbnails, hero, banners). Default: centre.

### 2.4 [MVP] Edit or delete my capture
- Edit title, description, tags, zone, metadata (no re-moderation of the image). Delete with confirmation; it disappears everywhere.
- Screens: Edit capture, Delete confirmation.

### 2.5 [MVP] My captures
- Owner sees all their captures with status (Processing, Under review, Published, Hidden, Rejected with reason, Failed with "Try again").
- Screens: My captures list (in own profile or settings).

---

## E3 — Discovery

### 3.1 [MVP] Browse the gallery
- Home and version pages `/v/{version}`: masonry grid of published captures, newest first, infinite scroll by pages of 30, end message "You've seen everything".
- Filters: zone, time of day, minimum quality (first option "Any"), sort (recent / popular / most downloaded). Filters are reflected in the URL.
- Each card: image, title, author, quality badge (name + colour), like button with count (hidden under 10; "New" badge under 7 days).
- Mobile: 2 columns, filters in a full-screen bottom sheet.
- Screens: Home, Version page (PLP), Filters (bar desktop / bottom sheet mobile), Version page empty ("Be the first to capture {version}").

### 3.2 [MVP] Search
- Search field in the header (icon on mobile). Suggestions of zones and tags after 3 characters.
- Results by relevance, recency or popularity; typo tolerance ("Suramr" → "Showing results for Suramar"); EN/FR zone names equivalent.
- No result: spelling suggestion, popular tags, latest captures.
- Screens: Search suggestions dropdown, Search results, No results.

### 3.3 [MVP] Capture page (PDP)
- Large image (click → full-screen viewer with zoom; mobile: swipe left/right for previous/next, pinch-zoom).
- Item tooltip right under the image (mobile) or in the side column (desktop): title in quality colour, quality badge, zone, in-game time, settings, character, green "Use:" line, caption in yellow italics.
- Author block: avatar, username, Follow (Later), social links.
- Actions: Like, Download original (signed-in only; visitors are asked to sign in then the download resumes), Share, Report, Edit/Delete (owner), Collect (Later).
- Mobile: sticky bottom action bar (Like, Download, Share).
- Comments below; "More from {author}" with fallbacks (see E8).
- Screens: Capture page (visitor / member / owner), Full-screen viewer, Sign-in prompt for download, Report modal, Share menu (desktop) / native share (mobile).

### 3.4 [MVP] Download in full resolution
- Original file, metadata stripped, colours preserved. Limit 100 per hour (message when exceeded).

### 3.5 [MVP] Home page
- Full-screen hero: a community capture chosen by the admin, dark gradient behind the text, title + two CTAs (visitor: "Explore the gallery" primary, "Upload" secondary) at the bottom left, author credit linking to the capture. Transparent header over the hero.
- Quest banner announcing an open contest (Later; hidden otherwise).
- Game version tabs (one scrollable line on mobile), "Capture of the week", latest captures grid.
- Screens: Home (visitor), Home (member), Home almost empty (launch).

### 3.6 [Later] Leaderboard
- Period (week / month / all time) and version filters; podium (carousel on mobile) + ranks 4–10, "Show ranks 11–50", then "Browse all by likes".
- Signed-in authors see "Your best this week": rank of their best capture and distance to the next milestone.
- Fewer than 10 captures in the period: switch to month/all time, or a progress gauge "Opens at 10 captures this week (4/10)" + Upload.
- Screens: Leaderboard, Leaderboard warming up.

### 3.7 [MVP] Share
- Mobile: native share sheet. Desktop: menu with Copy link, X, Facebook, Reddit, Discord. Shared links show a rich preview (image, title, author).

---

## E4 — Community

### 4.1 [MVP] Like
- Toggle like on others' captures (disabled on own). Visitors are asked to sign in. Crossing a quality threshold updates the badge and notifies the author.

### 4.2 [MVP] Comment
- Verified members, 1–1000 characters, plain text (no formatting, links not clickable), flat list (no replies). Edit within 15 minutes ("edited" label). Delete own comment, or any comment under own capture. Empty: "Be the first to comment". Too many comments: wait message.

### 4.3 [MVP] Notifications — "Quest log"
- Bell with unread count in the header (and tab on mobile). Page grouped "Today / Earlier", unread highlighted in yellow with a "!" quest marker, read in grey, "Mark all as read".
- Types: grouped likes ("X and 12 others liked…"), comments, new followers (Later), moderation decisions (with reason and how to appeal), quality tier reached, first capture explanation of quality, contests (Later).
- Screens: Bell dropdown (desktop), Quest log page, empty Quest log.

### 4.4 [Later] Follow photographers
- Follow from profile or capture page; "Following" feed; empty feed suggests 6 active photographers.

### 4.5 [Later] Collections
- Add a capture to a new or existing collection (public or private); collection page; up to 50 collections.

### 4.6 [Later] Weekly email digest
- Monday summary of unread notifications, one-click unsubscribe.

---

## E5 — Contests [Later]

- `/contests`: current contest, upcoming, archives with winners; empty state explains contests.
- Contest page: banner, theme, rules and dates, "Accept quest" (pick one of your eligible captures; ineligible ones shown greyed with their reason, the reason staying fully readable), live ranking (refreshed every 5 min) or blind voting (scores hidden).
- States: scheduled, open, extended by 7 days (too few entries), judging (frozen 48 h), closed with podium and badges, closed without podium, cancelled (reason shown).
- Accounts under 7 days old or sanctioned cannot join (button disabled with reason).
- Winner: "Contest winner" banner on the capture page, featured in the home hero for 7 days.
- Screens: Contests list, Contest page (each state), Entry picker modal, Entry confirmation.

---

## E6 — Moderation and admin [MVP]

- **Automatic moderation:** each capture and avatar is scanned; clear cases are published or rejected automatically, borderline ones go to review. The author is always notified with the reason and how to appeal.
- **Report content:** on captures, comments and profiles; reasons: nudity, violence or gore, hate or harassment, spam, stolen capture or copyright, personal information, other (+ comment). Visitors are invited to sign in. Content reported by 3 trusted members is hidden pending review.
- **Moderation queue** `/admin/moderation`: items pending review, hidden, alerts; oldest first; scores and reports; actions publish / hide / delete with mandatory reason.
- **Sanctions:** warning, suspension (1–90 days), ban (admin only); suspended users can browse but not act.
- **Admin areas:** game versions (create, rename EN/FR, reorder, archive), zones dictionary (merge free-text zones), site settings (quality thresholds, moderation thresholds, hero image, editor's pick, feature switches), beta invitations and waiting list, roles, audit log with filters. Later: contests, secret quests.
- Admin is desktop-first but must remain usable on tablet.
- Screens: Report modal, Admin moderation queue, Item review detail, Sanction modal, Admin settings, Admin versions, Admin zones review, Admin invitations / waiting list, Admin roles, Admin audit log.

---

## E7 — Platform [MVP]

- **Mobile navigation (< 768 px):** bottom tab bar Explore · Search · **Upload** (central, emphasised) · Notifications · Profile (Later: Leaderboard and Contests replace Search and Notifications). Header shrinks to emblem + search icon + avatar/Sign in, hides on scroll down.
- **Desktop header (one line):** logo · Explore · search (stretches) · Upload · notifications + avatar, or Sign in at the far right. Later: Leaderboard, Contests, Collections.
- **Footer:** Legal notice, Terms, Privacy, Cookie settings, Report a bug, language switch, Blizzard trademark notice.
- **Bilingual:** English default, French; language switch remembered.
- **Install as an app:** never on first visit; discreet banner after the 2nd visit or first published capture; iOS: instruction sheet "Share → Add to Home Screen".
- **Offline:** previously viewed captures still open; others show an Offline page; actions disabled with "You're offline" banner.
- **Update available:** toast "A new version is available · Reload" (waits until an upload finishes).
- **Cookie consent:** first visit panel with Accept all / Reject all / Customise of equal weight; changeable from the footer.
- **Report a bug:** modal from the footer (category, description, optional screenshot); visitors only get "I can't sign in"; confirmation with a reference number; rate-limit message.
- **Errors:** 404 and 500 pages in the site's style, 500 shows an error reference; API errors show a translated message and a Retry without losing the form.
- **Closed beta:** sign-up by invitation link only; others see a waiting-list form.
- **Accessibility:** keyboard navigation with visible focus, "Skip to content" link, focus trapped in modals and bottom sheets (Esc closes), alt text "{title} — {zone}, captured by {author}", reduced motion, quality always named in text, touch targets ≥ 44 px, no horizontal scroll at 360 px.
- Screens: Mobile tab bar, Header (desktop / tablet / mobile / transparent over hero), Footer, Cookie panel, Cookie settings, Install banner, iOS install sheet, Offline page, Offline banner, Update toast, Bug report modal (+ success, rate-limited), 404, 500, Waiting list, Legal pages.

---

## E8 — Quality tiers and cold start [MVP]

- **Quality tiers:** Poor / Uncommon / Rare / Epic / Legendary, reached by likes. Thresholds are admin settings (launch: 3 / 15 / 50 / 150; target later: 10 / 100 / 500 / 1000), so the UI must never hard-code numbers.
- **Explaining quality (touch points):** "?" next to the Minimum quality filter opens a tooltip with the 5 tiers and current thresholds + "How quality works"; tapping/hovering a quality badge shows "Rare · 15+ likes · 12 likes to Epic"; upload preview explains everything starts at Poor; one-time notification after the first published capture; notification on each tier reached; progress bars on own profile; help page `/help/quality`.
- **Never empty:** "More from {author}" falls back to "Similar captures" (same zone, then version), then "Latest in {version}", or disappears; "Capture of the week" falls back to most liked in 30 days, all time, then "Editor's pick"; empty version page "Be the first to capture {version}" + Upload; counters under 10 hidden, "New" badge instead.
- Screens: Quality tooltip, Quality badge popover (desktop) / bottom sheet (mobile), Help › How quality works, the empty and fallback variants listed above.

---

## E9 — Support the site [Later]

- "Support the site" in the footer and profile menu → `/support`: why support (real costs, transparency), amounts 2 €, 5 €, 10 € + free amount (min 2 €), no account needed, optional "Show a Supporter badge on my profile" (no effect on rankings).
- Payment on the provider's page; return: thank-you page or "payment being confirmed"; cancel: neutral page back to /support; receipt by email; donation history in settings (never public).
- Screens: Support page, Thank you, Pending, Cancelled, Settings › Donations.

---

## E10 — Secrets and easter eggs

All in-house (no Blizzard text, names, images or sounds), purely cosmetic, bilingual, static versions when reduced motion is on, no sound by default.

### 10.1 [MVP] Little surprises
- 404 page: hand-drawn treasure-map illustration, title "You have wandered into an uncharted zone", main button "Use Hearthstone" (back to home), plus search.
- Browser console greeting: ASCII logo + "Looking for guild? Report bugs: /feedback".

### 10.2 [Later] Easter eggs
- Konami code (↑↑↓↓←→←→BA) opens a "Need / Greed / Pass" loot-roll window on the Capture of the week; "Need" shows "You won: [Legendary Shot]", every visible thumbnail gets a Legendary border for 30 s, and a cosmetic "Ninja Looter" badge is added once.
- Search commands: `/dance` (logo dances 5 s), `/afk` (tab title "<AFK> Legendary Shots"), `mrglglgl` (no-results message subtitled "Mrgl mrgl, no captures found"), `leeroy` (button becomes "LEEEROY" and opens a random capture).
- 10 quick clicks on the logo: bubble "Stop poking me!".
- 5 minutes idle: tab title prefixed "<AFK>".
- 23 November (WoW anniversary): party accessory on the logo + quest banner "Happy birthday, Azeroth"; 31 October: Halloween accessory.
- Screens: Loot-roll modal, Loot won state, "Stop poking me" bubble, Anniversary home banner.

### 10.3 [Later] Secret quest "The Lost Shot"
- A seasonal chain of 5 to 7 clues hidden across the site (console message, 404 map, a capture's tooltip, a search phrase, the Konami code on a specific Legendary capture). Each correct answer reveals the next clue.
- Reward: unique badge and profile title ("Keeper of the Lost Shot"); the first 10 seekers are listed in a "Hall of Seekers" (opt-out possible). Visitors can read a clue but must sign in to keep progress.
- Admin creates seasonal quests (steps, clues EN/FR, answers).
- Screens: Clue reveal panel (styled like a quest text), Answer prompt, Quest completed + badge reveal, Hall of Seekers page, Admin › Secret quests.

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
