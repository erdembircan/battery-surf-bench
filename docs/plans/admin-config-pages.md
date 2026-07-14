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

### M2 refinements (from maintainer live-test)

- **Save button floppy icon** — the React `SaveButton` renders the mock's floppy-disk (save) icon via the shared pill icon system (`.bsb-admin-pill__icon--save` mask in `_admin-chrome.scss`), like `--external`.
- **Browse busy state** — surface the search hook's `isResolving`: while fetching, the results container shows a centered `@wordpress/components` `Spinner` (SPINNER ONLY, no "Loading…" label) INSTEAD of the stale rows; pager disabled while resolving. Applies to search, tab switch, and paging.
- **Server-seed the first Browse page** — `SettingsScreen::screen_config()` internally `rest_do_request`s `/wp/v2/search` (default args: `type=post`, `subtype=page,post`, page 1, `per_page=10`, `_fields=id,title,url,subtype`) and localizes `initialBrowse` (records + `X-WP-Total*`). React hydrates the Browse pane from the seed and skips the mount fetch (first paint has data, no spinner); only diverging args fetch. Keep PHP `per_page` and TS `PER_PAGE` tied (comment).
- **Zebra + hover on both row lists** — Browse rows and Selected rows get odd/even striping + hover, reusing the Sessions/DataViews row tints via SHARED tokens in `_admin-chrome.scss` (refactor Sessions to consume the same token if it hardcodes them — no two-headedness).
- **Fixed equal-height panes, inner scroll** — both picker panes share ONE fixed height (content no longer drives it, sized to ~10 Browse rows + controls + pager). Each pane is a flex column: pinned (non-scrolling) header/controls + a single `overflow-y:auto; min-height:0` scroll region + (Browse) a pinned-bottom pager. Browse pins the segmented filter/search/caption/meta on top and scrolls only the results list; Selected pins the heading/count/note on top and scrolls only the rows. Pinned regions get an opaque bg. Spinner centers in the scroll area; zebra + remove animation live inside it; verify dnd-kit drag still reorders across the scroll container (auto-scroll near edges).
- **Review discipline** — mock-derived UI gets an explicit element-by-element mock-vs-build parity pass, not just logic review + green tests (the floppy icon / busy state / zebra were missed by logic-only review).

### M2.5 — Shared admin chrome (extract; single source of truth, no two-headedness)

Sessions and Settings must NOT each own a copy-pasted header + button. Extract shared components so a design change to the base updates every admin screen at once.

- **`src/styles/_admin-chrome.scss`** (new shared partial) owns the admin-screen chrome once: the full-bleed coastal deck + wp-admin chrome-strip + CSS-var retint (moved out of `src/sessions/style.scss`), `.bsb-admin-head` (`__mark`/`__wordmark`/`__title`/`__subtitle`/`__actions`), and `.bsb-admin-pill` with `--solid` (filled teal-gradient primary) and `--outline` (teal secondary) modifiers + all states/focus ring. Both `src/sessions/style.scss` and `src/settings/style.scss` `@use` it; each keeps only its screen-specific rules (Sessions: DataViews retint + its live count slot; Settings: the picker panes). One edit here restyles both screens.
- **`includes/Admin/Views/AdminHeaderView.php`** (new `View`) — renders the brand mark + title + subtitle + a pre-rendered `actions` slot (composed markup interpolated as-is per the View composition rule). Escapes title/subtitle.
- **`includes/Admin/Views/AdminPillView.php`** (new `View`) — one pill for BOTH screens: props `label`, `variant` (`solid`|`outline`), optional `href` (→ `<a>`, else `<button>`), `target`, `icon` (e.g. `external`). Escapes label/href. This is the single button component the maintainer asked for.
- **Refactor `SessionsScreenView` and `SettingsScreenView`** to compose `AdminHeaderView` + `AdminPillView`; delete their duplicated header/button markup. Variant mapping: **Sessions "New Benchmark" = `solid`** (page's primary); **Settings "New Benchmark" = `outline`, "Save changes" = `solid`**. Same component, context-appropriate variant.
- **React `SaveButton`** renders with the shared `.bsb-admin-pill bsb-admin-pill--solid` classes (+ its own saving/saved state classes) so it's governed by the same SCSS — the one place where a solid admin pill is React-rendered rather than PHP-rendered.
- **Sync every reference in the SAME change** (no broken windows): update Sessions' SCSS/markup class names, the Sessions React live-count portal target if its class moves (prefer keeping the count slot's class stable to minimize churn), and **all unit tests + e2e selectors** that referenced the old `.bsb-sessions__head`/`.bsb-sessions__cockpit` classes. A stale e2e selector matches nothing and rots silently.
- **Tests** — unit tests for `AdminHeaderView` (renders mark/title/subtitle/actions, escapes) and `AdminPillView` (solid vs outline, `<a>` vs `<button>`, target/icon, escaping); Sessions' existing PHP/JS/e2e tests must stay green after the refactor. Update `docs/contracts/php-class-interactions.mmd` to add `AdminHeaderView`/`AdminPillView` and show both screen views composing them.

## M3 — Front-end wiring (design finalized from the current-code map)

Front-end TS needs **no change**: `context.pages` stays `{slug,title,url}[]`, `RunStore.currentSrc` reads only `.url`, `withSurferParams` appends `bsbTraits`/`bsbSpeed`. Two PHP seams:

### A. Emit the saved sequence — extend `CourseLibrary`
- `CourseLibrary::links()` (`includes/Course/CourseLibrary.php`) currently iterates `CourseCatalog::pages()` only (never reads the option). Inject two new constructor deps — the option name (`settings.option` = `bsb_course_order`) and a `CourseOrderSanitizer` — mirroring `SettingsScreen`'s params.
- `links()` reads+heals exactly like `SettingsScreen.php:222`: `$order = $sanitizer->sanitize( get_option( $option_name, $sanitizer->default_order() ) )`. Then walk `$order` **in saved order**, emitting per entry:
  - `bundled` → `{ slug, title: catalog->find(slug)->title(), url: add_query_arg($param, $slug, home_url('/')) }` (today's shape).
  - `user` → `{ slug: "user-{$id}", title: get_the_title($id), url: add_query_arg($param, "user-{$id}", home_url('/')) }` — the **router URL, NOT `get_permalink`** (see §B security redesign).
- No-option / empty → `default_order()` = the 5 bundled in catalog order → identical to today's behavior. The sanitizer already drops ineligible user ids (unpublished/not publicly-viewable/wrong type) and heals missing bundled — so `links()` is safe by construction. Output stays `{slug,title,url}[]` → `CoursePagesSource::value()` + the `bsb/course-pages` block binding + `context.pages` unchanged.
- Wire the new deps in `BatterySurfBench::managers()` (share the SAME `$order_sanitizer` instance already built for the option). `CourseCatalog` still injected.

### B. Serve user pages through the CONTROLLED router — NOT the real permalink (security redesign)
**The first M3 attempt (`UserPageEngine`) is a security flaw and is being removed.** It enqueued `surfer.js` + stamped `bsb-course-page` onto the user's REAL page, gated on the presence of the `bsbTraits` URL param. That makes client-controlled input decide whether the plugin injects its auto-interacting engine onto a real live page: anyone appending `?bsbTraits=…` to a selected page's permalink triggers it. Wrong and unsafe. **`bsbTraits` must never be the "is this a surf target" gate.**

Correct design — user pages are served the SAME way bundled pages already are: through `CourseRouter`'s controlled synthetic-render route, never the raw permalink. The engine only ever runs inside the plugin's sandbox route; the real permalink is never touched.
- **Delete `UserPageEngine`.**
- `CourseLibrary` emits user entries with the router URL `?bsbSessionPage=user-<id>` (done in §A), not `get_permalink`.
- `CourseRouter` (or a small collaborator) handles a `user-<id>` requested slug:
  - **Authoritative server-side gate:** resolve `<id>` and confirm it is in the saved `bsb_course_order` **user set** via `CourseOrderSanitizer::sanitize(get_option(...))` — the source of truth is the admin-saved option, checked server-side, NOT a URL param. If the id isn't a currently-selected, eligible user page → do not serve (fall through / 404).
  - **Hydrate the body:** build the synthetic `WP_Post` (same virtual-post mechanism as bundled) with `post_title = get_the_title($id)` and `post_content = ` the real post's content, rendered via `do_blocks(...)` so the page's own blocks render AND WordPress enqueues those blocks' view scripts/styles (the "encode the necessary scripts" part). Read the content through the WP API (`get_post`/`get_post_field('post_content')`), not raw file I/O.
  - Serve it through the SAME path bundled pages use — enqueue `surfer.js` + stamp `bsb-course-page` (reuse `CourseRouter`'s existing `enqueue_script`/`mark_course_body`, sharing the `body_class`/script constants already in Config). The course stylesheet is bundled-only; for a user page render, whether to include it is the router's existing behavior — keep the render representative (the block assets `do_blocks` enqueues cover the content styling).
- Because the engine lives only in this controlled route (a synthetic render of public, admin-approved content — exactly like the bundled synthetic pages), hitting the real permalink does nothing, and a non-selected id is rejected server-side. `bsbTraits`/`bsbSpeed` stay as the engine's behavior INPUT (appended by `withSurferParams`), never a gate.

### Front-end / engine
No TS change (contract unchanged). The engine already degrades on arbitrary content (`main`/`body` + generic `p/li/img/video` selectors, time-based leave) — verified in the first attempt — and now runs on the router-rendered body of the user's content.

### Tests
- PHP: `CourseLibrary` emits the saved sequence in order (bundled + user as `?bsbSessionPage=user-<id>` router URLs), drops ineligible user ids, no-option → 5 bundled. `CourseRouter` user-page path: serves a `user-<id>` slug ONLY when the id is in the saved user set (authoritative), 404s a non-selected/ineligible id, renders the post's content via `do_blocks` with `surfer.js` + `bsb-course-page`. Assert NO code path enqueues the engine on a real permalink. Remove the old `UserPageEngine` tests.
- e2e: add a real user page via settings, save, start a benchmark, assert it surfaces in rotation (as a `?bsbSessionPage=user-<id>` URL) and advances; AND assert that visiting the page's REAL permalink with `?bsbTraits=…` does NOT inject the engine / body class (the security regression test).
- Update `docs/contracts/php-class-interactions.mmd` (remove `UserPageEngine`; `CourseRouter`/`CourseLibrary` → `CourseOrderSanitizer`); `cockpit-frontend-modules.mmd` unchanged.

## Decisions log

Resolved:
1. ~~Include-bundled-pages toggle~~ → **No toggle.** Bundled pages are folded into the single Selected sequence, locked (no remove) but reorderable. **Superseded by M4** (below): bundled pages are now removable too, surfaced under a "Built-in" Browse filter for re-adding.
2. ~~Add control (combobox vs token field)~~ → **Two-pane content picker** (paginated + server-searched Browse pane → dynamic Selected sequence). Both first variants rejected.
3. ~~Reorder~~ → **Yes, drag-reorder** for every row (bundled + user, freely interleaved); feel = gap-open + tilted lifted row.
6. ~~Admin stack (React vs Interactivity)~~ → **React**, matching the Sessions admin screen. wp-admin is React in this repo; Interactivity is the front-end (cockpit/DevTools) tech. Admin-only screen ⇒ SSR/hydration gains are negligible.
7. ~~Use `<DataViews>`?~~ → **No.** Too opinionated to match the bespoke coastal picker. Reuse only the data layer (`useEntityRecords`/core-data, which is where the >100 pagination + server search live) and render custom markup.

4. ~~Menu shape~~ → **Settings replaces the empty top-level landing** (evolve `Menu` into `SettingsScreen`; Sessions stays a submenu). Default taken; maintainer may veto.

5. ~~M3 engine scope~~ → **Run the FULL engine on user pages.** Selected user pages behave exactly like bundled pages: enqueue `build/surfer.js` + stamp the `bsb-course-page` body class when the surfer trait param is present, so they scroll/interact and post `bsb:pageDone` to advance. Must verify the engine degrades gracefully on arbitrary themes/markup during M3.

## M3 REDESIGN — index-based serving (no page data on the client; security)

Supersedes §A/§B above. The client must know NOTHING about the pages (no IDs, URLs, titles, order, or count) — exposing post IDs / directly-reachable per-page URLs is the flaw. Navigation is by an opaque index the backend resolves.

- **Client:** holds an incrementing `activeIndex` counter (start 0). `RunStore.currentSrc` = `home_url('/?bsbSurfIndex=' + activeIndex + '&bsbNonce=' + surfNonce)` then `withSurferParams` (traits/speed). `PageAdvance` on `bsb:pageDone` just does `activeIndex + 1` — no wrap, no `pageCount`. REMOVE the `bsb/course-pages` block binding, `context.pages`, and the client-facing URL output of `CourseLibrary::links()`. Seed `surfNonce` (+ the base is `home_url`) via `wp_interactivity_config` in the cockpit's post-gate REST setup (like `restNonce`).
- **Backend (`CourseRouter`):** handle `?bsbSurfIndex=<n>` (registered query var, read via `get_query_var`): gate on `current_user_can($capability)` AND `wp_verify_nonce($nonce, 'bsb_surf')` → fail = fall through to 404. Read+heal the saved order; `count = len(order)`; resolve `order[ absint($n) % count ]` (**backend wraps** → client stays a pure counter, never learns the count). Render that entry through the existing `serve()` path — bundled slug → bundled content; `user` id → `get_post` content via `UserPageView` (title heading + content). `surfer.js` + `bsb-course-page` as today. Retire the public `?bsbSessionPage=<slug>` route.
- **Gates:** capability + surf nonce + `absint` + modulo-bounds (count is always ≥5 since bundled always present; still guard count==0 → 404).
- **Nonce edge:** minted at cockpit load (~12–24h life); a run started right after opening is fine. Accept; optional run-start refresh if wanted.
- Client no longer has page titles (removed with the pages array) — accepted.
- Tests: `CourseRouter` index route (valid nonce+cap+in-range → serves the right entry; bad/missing nonce → 404; non-admin → 404; wraps via modulo; user entry renders title). Front-end: `RunStore.currentSrc` builds the index URL + nonce; `PageAdvance` increments. Security e2e: `?bsbSurfIndex=0` without a nonce (or logged out) → not served. Update both contract charts (remove CoursePagesSource/pages binding edges; CourseRouter reads order+nonce).

## M4 — Removable built-in pages

Reverses the M1/decision-#1 stance that bundled pages are "locked (no remove)". A site owner can now drop any bundled page from the surf sequence and re-add it later — there is no permanently-pinned content any more, bundled or user.

### The core change: seed-default-only, not heal-always

Before M4, `CourseOrderSanitizer::sanitize()` force-reinserted any bundled page missing from the saved order on every read (settings-screen render, `CourseRouter`'s index resolution) and every write. That made bundled pages effectively un-removable: a site owner could drag them around but any drop was immediately reversed.

M4 flips this:

- **`CourseOrderSanitizer::default_order()`** is unchanged — still the 5 bundled pages in catalog order. It is now the **only** place that guarantees every bundled page is present, and it applies **only** when no order has ever been saved (a fresh install).
- **`CourseOrderSanitizer::sanitize()`** dropped its trailing force-reinsert loop entirely. It still validates/drops malformed entries, unknown bundled slugs, ineligible user ids, and duplicates — but a bundled page genuinely absent from the input stays absent in the output. Sanitizing is no longer "healing" in the sense of restoring lost bundled entries; it is purely defensive validation.
- Both read sites (`SettingsScreen::screen_config()`, `CourseRouter::resolve_indexed_page()`) already passed `$sanitizer->default_order()` as the `get_option()` default — that single seam is what still guarantees a fresh install surfs all 5 pages, without the sanitizer itself needing to backfill anything.
- `CourseRouter` needed no logic change: it already guarded `count === 0` → no render, and resolved `order[ absint($n) % count ]` for any `count >= 1`, so a saved order shorter than 5 (or a single page) was already handled correctly by the modulo — the plan's earlier "count is always ≥5" assumption (§M3 REDESIGN gates note above) no longer holds, and the guard band is now genuinely exercised.

### UI: the "Built-in" Browse filter

The Selected pane's lock column is gone — every row (bundled or user) renders the same `×` remove control and is equally draggable. The internal `kind: 'bundled'` identifier, the `RowBadge` value `'bundled'`, and the `.bsb-badge--bundled` CSS class are all **unchanged** — only the user-visible badge/tab label changed, from "Bundled" to **"Built-in"**.

Removing a bundled row doesn't strand it: the Browse pane gained a 4th segmented filter, **"Built-in"**, sourced client-side from `config.bundledCatalog` (bundled pages are never indexed by `/wp/v2/search`, so they can't come from the real-content query). Selecting it shows only the bundled catalog, filtered by the same search box (a plain client-side substring match — the catalog is a short, fixed list, not worth a round trip), each row with an Add/Added action wired to `addBundledPage`/`removeEntry` in `src/settings/Order.ts`. The **"All"** filter additionally pins the built-in rows atop its own first page (never on page 2+, and never on the Pages/Posts filters) so a fresh visitor sees the full catalog without hunting for the new tab — the pin never disturbs the real-content query's own pagination/total, which stay driven entirely by the `/wp/v2/search` response.

The Selected pane also gained an empty state (`.bsb-selected__empty`, mirroring `.bsb-browse__empty`): if every page — bundled and user alike — is removed, the list is replaced with copy pointing back at Browse and at Reset, since a benchmark needs at least one page.

### Chart/doc updates

`docs/contracts/php-class-interactions.mmd`: the `CourseRouter --> CourseOrderSanitizer` and `SettingsScreen --> CourseOrderSanitizer` edges no longer say "heals" — they say "sanitizes", since sanitize() no longer force-adds bundled pages. No class shapes/signatures changed. The React-internal Browse/Selected pane changes are not charted (see `admin-frontend-modules.mmd`'s header: screen-private React modules are out of scope for that chart).
