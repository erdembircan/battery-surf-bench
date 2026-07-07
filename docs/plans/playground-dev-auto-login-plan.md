# Playground Dev-Server Auto-Login Plan — Deterministic admin session for the persistent dev playground

## Problem

Starting the **development** playground (`pnpm playground` → `wp-playground/start.mts`, persistent, port 9400) does **not** log the browser in as admin, even though every dev blueprint carries a `{ step: 'login', username: 'admin' }` step. Every agent (and the maintainer) then has to manually walk the `wp-login.php` form — 5–10 minutes of friction per fresh session — just to reach an authenticated cockpit/admin.

The **e2e** playground (`start-test.mts`, non-persistent) appears to work, but only because Playwright's `tests/e2e/auth.setup.mts` performs a real `wp-login.php` credential submission and caches a storage-state cookie jar. The blueprint `login` step is **not** what authenticates e2e either — it is a no-op fallback there too. The dev server has no such fallback, so it serves logged-out pages.

## Ground truth this plan is built on

Pinned version: `@wp-playground/cli` and `@wp-playground/blueprints` are both **`3.1.39`** (`package.json`, resolved exactly in `pnpm-lock.yaml`). This version is pinned deliberately — the REST/e2e path is validated against it. **Do not bump or downgrade Playground to fix this.**

Verified against the installed 3.1.39 source (not memory, not the internet):

1. **The `login` step is nearly inert.** Its handler only calls
   `defineConstant("PLAYGROUND_AUTO_LOGIN_AS_USER", "admin")`, which persists
   `{"PLAYGROUND_AUTO_LOGIN_AS_USER":"admin"}` into the PHP instance's shared
   `/internal/shared/consts.json`. It sets no cookie and logs no one in.
   (`@wp-playground/blueprints@3.1.39/index.js`, handler `ls` at ~`:1796`.)

2. **A bundled mu-plugin does the actual login — via a redirect.** Every
   Playground WordPress install ships `/internal/shared/mu-plugins/1-auto-login.php`
   (`@wp-playground/wordpress@3.1.39/index.js:614-664`). On `init` priority 1, for
   any non-AJAX/non-REST request, **if** `PLAYGROUND_AUTO_LOGIN_AS_USER` is defined
   **and** the browser has no `playground_auto_login_already_happened` cookie, it
   calls `wp_set_auth_cookie()`, sets that cookie, and **issues a 302 redirect** to
   the same URL. No landing page or query param is required — the gate is purely
   "constant defined + cookie absent".

3. **The CLI `server` boot races the blueprint.** In
   `@wp-playground/cli@3.1.39/run-cli-B6snvP5v.js:1568-1580`, the HTTP server's
   `ready` flag is flipped **true right after WordPress files are installed**, and
   the blueprint — the thing that runs the `login` step and therefore defines
   `PLAYGROUND_AUTO_LOGIN_AS_USER` — is compiled and executed **afterward**. Real
   browser requests that land in that gap are forwarded to a WordPress instance
   where the constant is not yet defined, so `1-auto-login.php` returns early and
   the page renders logged-out. **There is no retry for that request.** A separate
   one-shot gate also answers the very first request with an empty self-redirect
   before PHP is touched. Net effect on the persistent dev server: unreliable-to-
   never auto-login, exactly as observed.

4. **The redirect fights our tooling.** The repo already documents that
   Playground's auto-login **redirect** is incompatible with proxy-style live
   reload (`wp-playground/live-reload.mts:118`). Any fix that keeps relying on the
   built-in redirect inherits that conflict.

5. **The "other project" precedent.** `pitch-vault` (archived) used
   `@wp-playground/cli@^3.0.52`, where the bare `login` step still auto-logged-in
   the persistent server — it predates the 3.1.39 race. That is why the maintainer
   remembers it "just working" elsewhere. We cannot lean on that version here.

## Approach

Stop depending on Playground's racy, redirect-based built-in auto-login for the
dev server. Inject **our own** dev-only auto-login **mu-plugin** through the same
`writeFile` blueprint mechanism the LiveReload client already uses
(`wp-playground/blueprint.mts` → `liveReloadStep`/`liveReloadMuPlugin`, written to
`/wordpress/wp-content/mu-plugins/bsb-live-reload.php`).

Why this is the right fix:

- **Deterministic, no redirect.** It calls `wp_set_current_user()` (authenticates
  the *current* request so the first rendered page is already admin) **and**
  `wp_set_auth_cookie()` (persists the session for every subsequent request,
  including the page's own REST XHRs). It never redirects, so it cannot fight
  LiveReload.
- **Zero race on resume.** The mu-plugin file is written into the **mounted,
  persisted** `wp-playground/wordpress/wp-content/mu-plugins/` directory. On every
  run after the first, the file is already on disk before the server boots — it is
  active from request zero, entirely outside the CLI's ready-flag race. (First-ever
  fresh boot still writes it during the blueprint, but a fresh boot is also
  downloading WordPress, so no browser is hitting it in that sub-second window; a
  single refresh covers it.)
- **Version-independent.** It does not rely on `PLAYGROUND_AUTO_LOGIN_AS_USER`, the
  bundled mu-plugin, or the CLI's boot ordering — so a future Playground change
  cannot silently break it again.
- **Precedented.** It is the exact pattern already trusted for `bsb-live-reload.php`.

### Disable the built-in redirect for the dev server

Remove the shared `loginStep` from `devBlueprint` and `devResumeBlueprint` **only**.
With `PLAYGROUND_AUTO_LOGIN_AS_USER` never defined, `1-auto-login.php` returns
early and never redirects — our mu-plugin is the sole login path on the dev server.
Keep `loginStep` in `e2eBlueprint` unchanged (see Scope).

## Changes

### 1. `wp-playground/blueprint.mts` — add the auto-login mu-plugin

Mirror the LiveReload helper shape so it is unit-testable and self-documenting:

- Add `autoLoginMuPlugin: string` — the PHP source (heredoc/template string), and
  `autoLoginStep(): NonNullable<BlueprintV1Declaration['steps']>` — the
  `mkdir` (idempotent, already created by `liveReloadStep`, but keep independent)
  + `writeFile` steps writing
  `/wordpress/wp-content/mu-plugins/bsb-dev-auto-login.php`.
- **Export** the builder(s) so the unit test asserts against the same source of
  truth (follow the `allowedPlugins`-is-exported precedent from pitch-vault and the
  existing exported blueprint builders).
- `devBlueprint(port)` steps become: `debugStep`, `activatePluginStep`,
  `autoLoginStep()`, `liveReloadStep(port)` — **`loginStep` removed**.
- `devResumeBlueprint(port)` steps become: `debugStep`, `autoLoginStep()`,
  `liveReloadStep(port)` — **`loginStep` removed**.
- `e2eBlueprint` — **unchanged** (still `loginStep`, `debugStep`,
  `activatePluginStep`).
- Update the doc comments to explain *why* the dev blueprints use a custom
  mu-plugin instead of the `login` step: the 3.1.39 ready-flag race defers the
  constant past server-ready, and the built-in login redirect conflicts with
  LiveReload. State the rationale **inline** — do not cite this plan's section
  numbers in code (`docs/plans` is disposable).

The mu-plugin PHP (final wording is the implementer's; these are the required
semantics and guards):

```php
<?php
/**
 * Battery Surf Bench dev auto-login. Injected by the Playground dev blueprint so
 * the persistent dev server serves an authenticated admin session to the browser
 * without a manual wp-login.php round-trip. Never present outside the dev
 * playground: it is written only by the dev blueprints and additionally guards on
 * the development environment type.
 *
 * Runs at init priority 0 (before anything that reads the current user) and never
 * redirects, so it is immune to the @wp-playground/cli 3.1.39 server boot race
 * that defers PLAYGROUND_AUTO_LOGIN_AS_USER past server-ready, and it does not
 * fight the LiveReload client the way Playground's own redirect-based auto-login
 * does.
 */
add_action( 'init', 'bsb_dev_auto_login', 0 );
function bsb_dev_auto_login() {
	// Defense in depth: only ever act inside the development playground.
	if ( 'development' !== wp_get_environment_type() ) {
		return;
	}
	// REST/AJAX requests authenticate via the cookie + nonce already; setting a
	// cookie on those responses is pointless and noisy. Mirror the behaviour of
	// Playground's own auto-login mu-plugin.
	if ( wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) ) {
		return;
	}
	if ( is_user_logged_in() ) {
		return;
	}
	$user = get_user_by( 'login', 'admin' );
	if ( ! $user ) {
		return;
	}
	// Authenticate the current request so the first rendered page is admin.
	wp_set_current_user( $user->ID, $user->user_login );
	// Persist the session for subsequent requests (and the page's REST XHRs).
	// Only settable before headers are sent; on a normal page load init is early
	// enough. If headers are already out, the current-user set above still makes
	// this page render authenticated and the next request will re-enter here.
	if ( ! headers_sent() ) {
		wp_set_auth_cookie( $user->ID );
	}
}
```

Notes for the implementer:
- Username `admin` is the Playground default admin (the `login` step defaults to
  it, and `auth.setup.mts` fills `admin`/`password`). No password is needed to set
  the auth cookie.
- No redirect anywhere — that is the whole point.
- Keep the PHP inside the TS template string, exactly as `liveReloadMuPlugin` does
  (it is not PHPCS-linted there and will not be here; that is consistent with the
  existing precedent, not a new suppression).

### 2. `wp-playground/blueprint.test.mts` — new vitest unit test

vitest already includes `wp-playground/**/*.test.{ts,mts}` (`vitest.config.mts:53-55`),
so a new file is auto-discovered. Test the **blueprint contract** (the steps the
CLI consumes), not internals:

- `devBlueprint(<port>)` **includes** a `writeFile` step whose `path` is
  `/wordpress/wp-content/mu-plugins/bsb-dev-auto-login.php` and whose `data`
  contains the auto-login markers (`bsb_dev_auto_login`, `wp_set_auth_cookie`,
  `get_user_by`, the `'development'` guard).
- `devResumeBlueprint(<port>)` includes the same `writeFile` step.
- `devBlueprint`/`devResumeBlueprint` **do not** include any `{ step: 'login' }`
  step (asserts the built-in redirect auto-login is disabled for the dev server).
- `e2eBlueprint` **does** include the `{ step: 'login', username: 'admin' }` step
  and **does not** include the auto-login mu-plugin (guards against accidentally
  changing the e2e auth path).
- Assert the LiveReload step is still present in the dev blueprints (regression
  guard — we are adding to, not replacing, the mu-plugin set).

Keep assertions behavioral: match on step `path`/`step` fields and substrings of
the emitted PHP, not on array indices or private structure.

## Verification (live — the real proof)

Unit tests prove the blueprint emits the right file; they cannot prove the dev
server actually serves an authenticated page. Verify end-to-end:

1. Start the dev server from the branch: `pnpm playground` (or
   `pnpm playground:fresh` for a clean first-boot check). It resolves an open port
   from 9400; note the actual port from the ready log. **Respect the maintainer's
   running instance** — if 9400 is taken it will increment; do not kill the
   maintainer's playground.
2. With a **fresh cookie jar** (no prior session), confirm the server serves
   authenticated content:
   - `curl -s -c jar.txt -b jar.txt -L http://127.0.0.1:<port>/wp-admin/` reaches
     the dashboard (does **not** land on `wp-login.php`), and a follow-up request
     shows the admin bar / `wordpress_logged_in` cookie was set.
   - Confirm no redirect loop.
3. Confirm REST still authenticates: the cockpit page renders with a valid
   `wp_rest` nonce and its REST XHRs succeed (cockpit loads its data without a 401).
4. Confirm LiveReload still injects (`bsb-live-reload.php` present and the client
   script enqueued) — i.e. we did not disturb the existing dev mu-plugin.
5. Restart (`pnpm playground` again, resume path) and confirm auto-login is
   immediate from the first request (persisted mu-plugin, no race).
6. Tear down any playground this verification started; never leave an orphan on
   9400/9401.

Prefer driving the browser check through the maintainer's authenticated Chrome
instance per project convention; use `curl` with an explicit cookie jar for the
deterministic, scriptable assertion.

## Scope

**In scope:** the persistent **dev** server auto-login only (`devBlueprint`,
`devResumeBlueprint`), its unit test, and the inline rationale comments.

**Explicitly out of scope (do not touch):**
- `e2eBlueprint`, `auth.setup.mts`, `playwright.config.mts`, and any e2e spec. The
  e2e suite is green via its own form-login + storage-state; unifying it onto the
  mu-plugin is a separate, riskier change. Leave the e2e `login` step in place.
- Bumping/downgrading `@wp-playground/*`.
- Patching `node_modules` / `patch-package` against the CLI race.

## Tests, lint, charts, CI

- **Unit:** the new `wp-playground/blueprint.test.mts` (above). Run `pnpm test`.
- **e2e:** no change — the dev mu-plugin is not exercised by the e2e server, and
  e2e cannot drive the dev server. No new spec (nothing in the e2e-covered surface
  — rendered markup, routes, user flows on the *test* server — changes).
- **Lint/format:** `pnpm lint:js` + `pnpm format` over the changed `.mts` files.
  Read full output; never pipe through `tail`. The PHP-in-string is not PHPCS
  territory (consistent with `liveReloadMuPlugin`).
- **Charts:** none. `docs/contracts/` covers app architecture and CI; no chart
  models the playground dev tooling. (Verified: only `ci-workflow.mmd` references
  playground, and only as a CI job.) State this in the PR.
- **CI:** wait for the full check set to finish green before sign-off.

## Delivery

- Branch is the existing worktree branch. Commit as
  `[FIX]: auto-login the persistent dev playground server`.
- Open a **draft** PR (`gh pr create --draft`), body = concise human summary
  (problem → root cause → fix → verification). No AI attribution, no session URL.
- Do not squash-merge; the maintainer does the final review.
