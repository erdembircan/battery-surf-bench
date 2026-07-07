# Admin Config Screen — User-Selectable Test Pages

Status: in progress. Single PR, three milestones, maintainer signs off each milestone before the next starts.

## Goal

The plugin ships a top-level admin menu whose landing page is empty (`Menu::render()` prints only an `<h1>`). Turn that into a real **settings screen**, matching the Sessions screen's Coastal Daybreak design language, whose first section lets a site owner add their **own posts and pages** to the surfer's test-page rotation — picked from dropdown/searchable controls, never by typing an ID. The chosen pages are then served to the front-end cockpit alongside the bundled pages.

## Milestones (one PR, sequential sign-off)

- **M1 — Styling & mocking (current).** Standalone HTML mockups of the config screen under `docs/mockups/`. No production code. Iterate with maintainer until a direction is approved.
- **M2 — Admin UI implementation.** Build the approved screen: a `Manager` + `View` + themed `@wordpress/components` React app + SCSS, persisting the selection to a WP option. No front-end wiring yet — the saved data is not consumed by the cockpit.
- **M3 — Front-end wiring.** Feed the saved user pages into the cockpit's `context.pages` and make the surf engine actually run on them.

Each milestone is a set of commits in the same branch/PR (`worktree-admin-menu-update`). Do not open new worktrees or PRs per milestone.

---

## M1 — Mocks (DELIVER NOW)

### What the screen must contain (informs the mock content)

The screen is an extensible **Settings** deck. Section one (the hero, and currently the only one) is **Test Pages**:

1. **Brand header** — structurally identical to `SessionsScreenView` / `src/sessions/style.scss`: surfer mark + wordmark (title "Battery Surf Bench" in Anton uppercase, subtitle eyebrow e.g. "SETTINGS" in teal small-caps with wide letter-spacing). A primary **Save changes** pill (teal gradient, mirrors the `.bsb-sessions__cockpit` CTA slot) lives in the header right or a sticky save bar.

2. **Test Pages section** — heading + one-line description: "Choose which pages the simulated surfer visits during a benchmark. Add your own posts and pages alongside the bundled set."

3. **Bundled pages** — the 5 shipped pages shown as a locked, muted group, each row a "Bundled" badge, no remove control. Titles: *The Hidden Cost of a Browser Tab*, *Inside the Machine*, *What Drains a Laptop Battery, Ranked*, *Watch: Inside a Modern Laptop's Power Path*, *News Hub: Energy & Computing*. (Explore whether a master "Include bundled pages" toggle belongs here — variant A shows it, variant B omits it.)

4. **Your pages** — the add control + the chosen list:
   - **Add control** — must map to a real themed `@wordpress/components` control in M2 (this constrains the mock: no bespoke widget that can't be themed onto a WP component).
     - *Variant A:* segmented `Pages | Posts` type filter (cockpit `.bsb-seg` look) + a searchable **ComboboxControl** ("Search pages…") + **Add** button.
     - *Variant B:* a multi-select **FormTokenField** ("Add pages or posts") — type to filter, pick multiple, chosen items render as tokens.
   - **Chosen list** — ordered rows: index, title, type badge (Page/Post), permalink in Space Mono (muted), remove (×, coral). Order matters (surf sequence); show a drag handle. Mark drag-reorder as a nice-to-have for M2 (may fall back to add-order).
   - **Empty state** — "No custom pages yet — search above to add your first."

### Design constraints (front-loaded so mocks don't drift)

- **Coastal Daybreak, light only.** No dark states. Tokens: accent `#2f9bb3` / deep `#1c7e96` / gradient `linear-gradient(150deg,#2f9bb3,#1c7e96)`; ink `#1f3a5f`; coral `#ff7a5c` (destructive); sun `#ffce5c`; surfaces white, 13px radius, soft shadow; hairline `--line`.
- **Fonts via CDN** (mock only): Anton, Hanken Grotesk (400/600/700), Space Mono, Pacifico, Caveat — Google Fonts.
- **Full-bleed deck** — strip default page chrome; the real screen retints WP-admin vars and hides `#wpfooter` exactly like `src/sessions/style.scss`.
- **`bsb-` BEM class names** throughout, so the port to SCSS is mechanical.
- **Self-contained** — inline CSS/JS, no build step, opens directly in a browser. Reuse `docs/mockups/surfer.svg` for the mark.
- Every control must map to a themeable `@wordpress/components` / DataViews counterpart so M2 is "theme the WP component," matching how Sessions themes DataViews.

### Design pivot (maintainer feedback, supersedes the first two variants)

The combobox and FormTokenField variants were **rejected**: a single search box that filters an already-loaded short list reads as a *filter*, not a selection, and silently assumes a site has ~10 pages. Real sites have hundreds. The picker MUST be built for scale:

- **Browse pane (source):** a paginated list of the site's content (10/page) with `‹ Prev / Next ›` and a total count. Search **queries the whole site server-side** (all posts), not the currently-loaded page. `All | Pages | Posts` type filter. This is the **DataViews** pattern (Sessions already uses it) — server pagination + server search + per-row action.
- **Selected pane = the single surf sequence.** It is the ONE list of everything the surfer visits, in order. It is **seeded with the 5 bundled pages** (each carrying a "Bundled" badge + lock glyph, **no remove control** — they cannot be dropped) and then user-added pages (with `×` remove). Numbered `1..n` across the whole combined list.
- **Reorder is a first-class requirement.** Every row — bundled and user alike — is drag-reorderable and may be interleaved anywhere in the sequence. Bundled rows are locked against *removal*, not against *reordering*.
- There is **no separate "Bundled pages" component and no include-bundled toggle.** Bundled pages are always present, folded into the sequence. (An earlier mock split them into their own locked group with a toggle — rejected: it contradicts "bundled can't be removed" and duplicates the list.)
- The Selected sequence **persists independently of the browse pane's pagination/search** — a pick made on page 5 must not disappear when the user pages back to 1.
- Add from a browse row (`+` / Add) appends to the sequence; the row then shows `✓ Added`/disabled. Remove a user row (`×`) re-enables its source row.

### M1 deliverables

- `docs/mockups/config-pages.html` — the single approved direction: two-pane content picker (paginated + server-searched Browse pane, one unified Selected sequence), Coastal header + Save pill. The Selected list is seeded with the 5 bundled rows (locked, no remove, but drag-reorderable) and takes user-added rows below/among them. No separate bundled group, no toggle. Wire **dummy JS over ~140 fake posts** so search / pagination / add / remove **and drag-reorder** are live and scale is tangible.
- Delete the rejected `docs/mockups/config-pages-a.html` and `config-pages-b.html`.
- Replace the "Admin config screen" section in `docs/mockups/README.md` with a single row for `config-pages.html`.
- While editing `README.md`, fix the stale dark-mode line (references a light/dark toggle that no longer exists) — a broken window in a file we're already touching.

### M1 acceptance

Rendered in a browser, the mock reads as the same family as the Sessions screen (header proportions, teal pill CTA, coastal surfaces) and demonstrably handles scale: searching queries the full pool (not the visible page), pagination pages through 100+ items, and the Selected list survives paging/searching. Every element maps to a DataViews/WP-component counterpart. No dark mode. Presented to maintainer before any M2 code.

---

## M2 — Implementation (after M1 sign-off; plan is provisional, revisit post-mock)

Mirror the Sessions wiring exactly:

- **Menu shape (decision #4 → resolved): Settings replaces the empty top-level landing.** Evolve the existing top-level `Menu` into the Settings screen rather than adding a parallel submenu — the top-level `battery-surf-bench` menu page now renders the settings app (retiring the empty `printf`), Sessions stays a submenu, no dead page. Prefer renaming `includes/Admin/Menu.php` → `includes/Admin/SettingsScreen.php` (a Manager that owns the top-level `add_menu_page`, keeps the existing menu-icon CSS-mask enqueue, AND enqueues the settings bundle/style + registers the option) so one Manager owns the top-level surface end-to-end; if the rename ripples too far into wiring/tests, mount the settings app in `Menu::render()` in place instead. Either way: capture the top-level `$hook_suffix` and only enqueue the settings bundle + `build/style-settings.css` (with `wp-components` style dep) on that screen; localize a `bsbSettings` global (enumerated selectable post types [`page`,`post`], the saved sequence, the bundled catalog list, the cockpit URL/label); set script translations.
- **`includes/Admin/Views/SettingsScreenView.php`** (`View`) — heredoc brand-header + `<div id="bsb-settings-app">` mount, following `SessionsScreenView` (owns its own escaping). Header carries TWO actions: a **"New Benchmark"** cockpit-launch link (secondary/outline teal pill, `target="_blank"` to the cockpit URL — reuse the exact `cockpit_url`/`cockpit_label` the `SessionsScreen` already passes its view) plus the primary **"Save changes"** button. Save is the page's primary (filled gradient); New Benchmark is the secondary launch action.
- **Stack = React (matching the Sessions admin screen; decision #6), but NOT the `<DataViews>` component.** wp-admin screens in this repo use React (`@wordpress/element` `createRoot` + `@wordpress/core-data`); the Interactivity API is the *front-end* (cockpit/DevTools) technology and is NOT the precedent for an admin screen. Mirror `src/sessions/` structure for mounting and data, but render our own markup.
- **Do NOT use `@wordpress/dataviews` here (decision #7).** DataViews is opinionated (its own toolbar, filter/field/view chrome, pagination UI) and styling it to the bespoke coastal picker would be a fight — the value we need from the Sessions stack is the *data layer*, which lives in `useEntityRecords`/core-data, **not** in the `<DataViews>` component. Take the hook, drop the component.
- **`src/settings/` React app** — `index.tsx` mounts into `#bsb-settings-app` via `createRoot` (like `src/sessions/index.tsx`).
  - **Browse pane** = a **custom coastal list component** (the exact mock markup: title + type badge + Add button rows, our own Prev/Next pager). **Data source = the core `/wp/v2/search` endpoint, ONE unified paginated query** (not two per-type `useEntityRecords` calls — that approach can't be merged into one pager: concatenating page-N-of-pages + page-N-of-posts and slicing to 10 silently drops items, and a shared page cursor 400s past one type's last page). Query `subtype` = `page,post` for "All", or the single type for the Pages/Posts tabs; `type=post`, `search`, `page`, `per_page`, `_fields=id,title,url,subtype`. This gives correct server pagination + server search across both types in one request, with accurate `totalItems`/`totalPages` from the `X-WP-Total`/`X-WP-TotalPages` headers — the >100-safe pattern. Verify the installed `@wordpress/core-data` `search` entity (kind `root`, name `search`) and use `useEntityRecords('root','search', …)`; if absent, `apiFetch` to `/wp/v2/search` with `parse:false` to read the headers. Search records expose `title` as a plain string and `subtype` (`page`/`post`) — badge off `subtype`, add with `{id, subtype, title}`. A per-row "Add" pushes into the Selected sequence.
  - **Selected pane** = a custom React ordered-list component driven by local state (the saved `course_order`), themed with `@wordpress/components`. Fixed CSS grid rows (handle · index · lock · title[1fr, ellipsis] · badge · remove) so columns align regardless of title length; title only, no URL subtext. Bundled rows locked (no remove) but draggable; user rows have remove.
  - **Drag** = **@dnd-kit** (`@dnd-kit/sortable` + a `DragOverlay` rendering the tilted lifted row) to reproduce the feel the mock demos with SortableJS (gap opens at the drop target, lifted row tilts). The mock's SortableJS is demo-only — production uses @dnd-kit. Keyboard-accessible: drag-only is not enough — provide move up/down affordances too.
  - **Drag lib = `@dnd-kit`** (`@dnd-kit/core` + `@dnd-kit/sortable` + `DragOverlay`) — a new dependency; headless, so no styling fight, and it reproduces the mock's gap-open + tilted-overlay feel. Flag the added dep in the PR.
  - Never expose a manual-ID field. **Save via the core-data site-settings entity, NOT a custom REST controller:** `register_setting` the option with a full `show_in_rest` schema (`array` of `{kind,slug}`/`{kind,id}` objects) + `manage_options`, then read/write it in React through `useEntityRecord('root','site')` / `saveEditedEntityRecord` (the `/wp/v2/settings` route). This is the idiomatic no-controller path; only fall back to a custom `register_rest_route` controller if the settings-entity schema can't express the ordered heterogeneous array cleanly.
- **The 100-per-request cap (maintainer flagged; Sessions already solved it).** WP REST hard-caps `per_page` (and `include`) at 100 and Sessions did **not** raise it — it does genuine page-by-page server pagination (commit `53a5e07`): keep `page`/`per_page` in DataViews `View` state, rebuild the query on every view change, let `useEntityRecords` refetch per page, and read `totalItems`/`totalPages` from the `X-WP-Total`/`X-WP-TotalPages` headers core-data parses — never one-shot-fetch-then-slice client-side. **Browse pane:** already page-at-a-time over core `page`/`post` types, so no truncation and (since we only search by title + filter by type, not by meta) **no custom `*RestQuery` is needed** — unlike Sessions, which added `SessionRestQuery` only to sort/filter by *meta* columns. **The real trap is rehydrating the saved selection:** a user may have saved 150+ user pages, and resolving their titles/permalinks via `include: [ids]` is *also* capped at 100/request. Fetch them in **chunks of ≤100** (page the `include` requests and accumulate), or snapshot `{title,url}` into the saved order at save time and refresh lazily — prefer chunked `include` so titles stay fresh. Whatever the choice, **never issue a single >100 request and assume it returned everything** (that is exactly the Sessions bug).
- **`src/settings/style.scss`** — port the approved mock; `@use '../styles/theme'`; retint WP-admin vars like `src/sessions/style.scss`.
- **Persistence** — because bundled and user pages share ONE reorderable sequence, the saved shape cannot be a bare `number[]`; it is an **ordered heterogeneous sequence**. Option `bsb_settings` shaped `{ course_order: Array<{ kind: 'bundled', slug: string } | { kind: 'user', id: number }> }`, registered with `register_setting` + `show_in_rest` and a sanitize callback that: validates bundled slugs against `CourseCatalog`'s known set, coerces user ids to ints of existing published viewable posts, drops unknowns, and — importantly — **re-inserts any bundled page missing from a stale saved order** (bundled pages can never be dropped, so a saved order that lost one because the catalog changed must heal). Default value = the 5 bundled entries in catalog order. Add config keys to `includes/Config.php`; add the webpack entry; instantiate the Manager in `BatterySurfBench::managers()`.
- **Tests** — PHPUnit for the Manager (hooks registered, add_submenu_page args, option registered/sanitized) and the View (renders mount + escaped strings); Vitest for the React store/reducer logic (add/remove/reorder, dedupe, no manual-ID path); e2e Playwright spec for the screen route + adding/saving a page (new user-facing route → e2e is mandatory, same change). Update `docs/contracts/php-class-interactions.mmd` for the new admin classes.

### M2.5 — Shared admin chrome (extract; single source of truth, no two-headedness)

Sessions and Settings must NOT each own a copy-pasted header + button. Extract shared components so a design change to the base updates every admin screen at once.

- **`src/styles/_admin-chrome.scss`** (new shared partial) owns the admin-screen chrome once: the full-bleed coastal deck + wp-admin chrome-strip + CSS-var retint (moved out of `src/sessions/style.scss`), `.bsb-admin-head` (`__mark`/`__wordmark`/`__title`/`__subtitle`/`__actions`), and `.bsb-admin-pill` with `--solid` (filled teal-gradient primary) and `--outline` (teal secondary) modifiers + all states/focus ring. Both `src/sessions/style.scss` and `src/settings/style.scss` `@use` it; each keeps only its screen-specific rules (Sessions: DataViews retint + its live count slot; Settings: the picker panes). One edit here restyles both screens.
- **`includes/Admin/Views/AdminHeaderView.php`** (new `View`) — renders the brand mark + title + subtitle + a pre-rendered `actions` slot (composed markup interpolated as-is per the View composition rule). Escapes title/subtitle.
- **`includes/Admin/Views/AdminPillView.php`** (new `View`) — one pill for BOTH screens: props `label`, `variant` (`solid`|`outline`), optional `href` (→ `<a>`, else `<button>`), `target`, `icon` (e.g. `external`). Escapes label/href. This is the single button component the maintainer asked for.
- **Refactor `SessionsScreenView` and `SettingsScreenView`** to compose `AdminHeaderView` + `AdminPillView`; delete their duplicated header/button markup. Variant mapping: **Sessions "New Benchmark" = `solid`** (page's primary); **Settings "New Benchmark" = `outline`, "Save changes" = `solid`**. Same component, context-appropriate variant.
- **React `SaveButton`** renders with the shared `.bsb-admin-pill bsb-admin-pill--solid` classes (+ its own saving/saved state classes) so it's governed by the same SCSS — the one place where a solid admin pill is React-rendered rather than PHP-rendered.
- **Sync every reference in the SAME change** (no broken windows): update Sessions' SCSS/markup class names, the Sessions React live-count portal target if its class moves (prefer keeping the count slot's class stable to minimize churn), and **all unit tests + e2e selectors** that referenced the old `.bsb-sessions__head`/`.bsb-sessions__cockpit` classes. A stale e2e selector matches nothing and rots silently.
- **Tests** — unit tests for `AdminHeaderView` (renders mark/title/subtitle/actions, escapes) and `AdminPillView` (solid vs outline, `<a>` vs `<button>`, target/icon, escaping); Sessions' existing PHP/JS/e2e tests must stay green after the refactor. Update `docs/contracts/php-class-interactions.mmd` to add `AdminHeaderView`/`AdminPillView` and show both screen views composing them.

## M3 — Front-end wiring (after M2 sign-off; plan is provisional)

- **Rebuild `CourseLibrary::links()`** (or add a collaborator, e.g. `CourseSequence`) to emit the saved `course_order` sequence in its saved order — walking the heterogeneous list, resolving each `bundled` entry from `CourseCatalog` (`?bsbSessionPage=<slug>` url) and each `user` entry via `get_the_title`/`get_permalink` as `{ slug: "user-<id>", title, url }`. The output is still `{slug,title,url}[]`, so `CoursePagesSource`, the Block Binding, `context.pages`, and `RunStore.currentSrc` need **no** shape change — only the ordering/source of the array changes. When no option is saved, fall back to the current bundled-only order (preserves today's behavior).
- **Guards** — resolve each saved ID at render; skip any that no longer exist, aren't published, or aren't publicly viewable. Sanitize again on read (defense in depth).
- **Surf engine on user pages (the real work).** Bundled pages are virtual posts that `CourseRouter` renders with `build/surfer.js` enqueued and a `bsb-course-page` body class. Real user pages have neither, so:
  - the surf engine never boots → the iframe posts no `bsb:pageDone` → `PageAdvance` never advances past a user page;
  - `PageGuard.isCoursePageLoaded` (keys off the `bsb-course-page` body class) mis-reads the loaded user page as a failed navigation.
  - **Fix:** on `wp_enqueue_scripts`, when the current singular post's ID is in `bsb_settings.course_pages` **and** the surfer trait param is present, enqueue `build/surfer.js` (same boot path `CourseRouter` uses) and add the `bsb-course-page` body class via `body_class`. This makes a real user page behave like a course page for the engine. Confirm the engine's scroll/interaction sim degrades gracefully on arbitrary themes (no assumptions about bundled markup) — **verify against a real page during M3**, and flag to maintainer if the engine needs a "generic page" mode.
- **Tests** — extend PHP tests for the merged link list + guards; e2e that a user-selected page appears in the cockpit rotation and advances. Update `docs/contracts/cockpit-frontend-modules.mmd` / `php-class-interactions.mmd` if the class graph changes.

## Decisions log

Resolved:
1. ~~Include-bundled-pages toggle~~ → **No toggle.** Bundled pages are folded into the single Selected sequence, locked (no remove) but reorderable.
2. ~~Add control (combobox vs token field)~~ → **Two-pane content picker** (paginated + server-searched Browse pane → dynamic Selected sequence). Both first variants rejected.
3. ~~Reorder~~ → **Yes, drag-reorder** for every row (bundled + user, freely interleaved); feel = gap-open + tilted lifted row.
6. ~~Admin stack (React vs Interactivity)~~ → **React**, matching the Sessions admin screen. wp-admin is React in this repo; Interactivity is the front-end (cockpit/DevTools) tech. Admin-only screen ⇒ SSR/hydration gains are negligible.
7. ~~Use `<DataViews>`?~~ → **No.** Too opinionated to match the bespoke coastal picker. Reuse only the data layer (`useEntityRecords`/core-data, which is where the >100 pagination + server search live) and render custom markup.

4. ~~Menu shape~~ → **Settings replaces the empty top-level landing** (evolve `Menu` into `SettingsScreen`; Sessions stays a submenu). Default taken; maintainer may veto.

Still open:
5. M3: is engine-on-user-pages in scope, or do user pages just load (time-based advance)? Big scope fork — settle before M3 build.
