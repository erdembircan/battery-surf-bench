# Plan: AI agent support (Abilities API + MCP Adapter)

Commit this file verbatim as `docs/plans/AgentAbilities.md` in your first commit. The orchestrator tells you when to delete it (the last commit of the PR).

## Goal

Battery Surf Bench registers its own **abilities** with the WordPress core Abilities API (core since 6.9; the plugin requires 7.0). Abilities are reachable through core's REST API (`/wp-json/wp-abilities/v1/…`) and, when the site also runs the official **MCP Adapter** plugin (wordpress.org slug `mcp-adapter`, v0.7.2), through its default MCP server (`/wp-json/mcp/mcp-adapter-default-server`, tools `mcp-adapter-discover-abilities`, `mcp-adapter-get-ability-info`, `mcp-adapter-execute-ability`). The plugin does **not** depend on the MCP Adapter (no `Requires Plugins` header): it only registers abilities; the adapter picks up abilities whose `meta.mcp.public` is true.

A dev-only **agent playground** (`composer serve:agent`) boots a fresh Playground with the MCP Adapter, deterministic seeded runs and pages, application passwords enabled, and prints the MCP endpoint and credentials.

## Verified facts about the installed APIs (WordPress 7.1.4, MCP Adapter 0.7.2) — design around these

- `wp_register_ability( string $name, array $args )` only works inside the `wp_abilities_api_init` action; `wp_register_ability_category( string $slug, array $args )` only inside `wp_abilities_api_categories_init`. Outside them: `_doing_it_wrong` + `null`, silently. Both actions fire lazily (first use after `init`).
- Ability name regex: `^[a-z0-9-]+/[a-z0-9-]+$`. Category slug regex: `^[a-z0-9]+(?:-[a-z0-9]+)*$`.
- Allowed `$args` keys only: `label`, `description`, `category`, `execute_callback`, `permission_callback`, `input_schema`, `output_schema`, `meta` (and `ability_class`, unused). Any other key is rejected with `_doing_it_wrong`.
- `meta` keys used here: `annotations` (`readonly`, `destructive`, `idempotent`), `show_in_rest` (bool), `mcp` (`array( 'public' => true, 'type' => 'tool' )`). Set `show_in_rest => true` and `mcp.public => true` explicitly on every ability; do **not** rely on `meta.public` (7.1-only; the plugin supports 7.0).
- Input: if `input_schema` is set and the input is `null`, core uses the schema's **top-level** `default`; per-property `default`s are **not** applied. So every input schema is `type: object` with `'default' => array()` and `'additionalProperties' => false`, and each execute callback applies its own property defaults.
- Input is validated with `rest_validate_value_from_schema()` before the permission callback. The execute and permission callbacks receive the validated input as their single argument.
- Output is validated against `output_schema` with `rest_validate_value_from_schema()`; mismatches become `ability_invalid_output`. Nullable fields must be declared as `'type' => array( 'number', 'null' )` etc. Cast every value to its declared type before returning.
- Returning a `WP_Error` from the execute callback is passed through as is (the REST run endpoint uses its `status` data; the MCP adapter turns it into `{"success":false,"error":"<message>"}`). Always give errors `array( 'status' => <code> )`.
- REST run method is decided by annotations: `readonly` → GET (input as query `input[…]`); `destructive` **and** `idempotent` → DELETE (query input); everything else → POST (JSON body `{"input":{…}}`).
- Application passwords over plain HTTP are only available when `wp_get_environment_type() === 'local'` or via the `wp_is_application_passwords_available` filter. The dev blueprints use `development`, so the agent playground needs a mu-plugin returning true from that filter.
- MCP Adapter installs in Playground with the blueprint step `{ step: 'installPlugin', pluginData: { resource: 'url', url: 'https://downloads.wordpress.org/plugin/mcp-adapter.0.7.2.zip' } }` (proven). Cookie or application-password auth both work on its REST route.

## Hard constraints (from CLAUDE.md — re-read it)

- PHPCS + WordPress Plugin Check must pass with **no new suppressions**. Never use `meta_query`, `meta_key`, `meta_value`, `posts_per_page` > 100 or `-1`, `orderby` by meta. Read sessions with `get_posts()` in pages of 100 and filter/sort in PHP (see `SessionReader`).
- No markup in PHP logic; there is none in this feature (abilities return arrays).
- PHPDoc on every class and method with full types (`@param`, `@return`, never `@returns`). Document the `Ability` interface exactly the way `includes/Settings/OptionProvider.php` and `includes/Support/Manager.php` are documented.
- CamelCase file names. Prefixes: PHP namespace `ErdemBircan\BatterySurfBench`, error codes `bsbench_*`, ability namespace `battery-surf-bench/`.
- Translate every human-readable string with `__()` / `_n()` and the `battery-surf-bench` text domain, built inside the hook callbacks (never at construction time), with `/* translators: */` comments on every placeholder string.
- Tests: PHPUnit (Brain Monkey, extend `Tests\TestCase`) for every new class, e2e for the REST/MCP surface. Never touch the real filesystem in tests.
- Update `docs/contracts/php-class-interactions.mmd` and run `pnpm contracts:verify`.
- Never pipe lint/test output through `tail`/`head`. Run `composer check; echo "EXIT=$?"` before every push.

## Architecture

New domain folder `includes/Abilities/`, plus one helper in `includes/Content/` and one small addition to `CourseCatalog`.

```
AbilityRegistry (Manager)
  ├── registers category  battery-surf-bench
  └── registers each Ability (14), adding category, permission (CapabilityInterface), meta

Ability (interface)  ← 14 classes, one per ability
  name(): string                  'battery-surf-bench/list-runs'
  definition(): array             label, description, input_schema, output_schema, annotations
  execute( array $input ): array|WP_Error

SessionReader      reads published bsbench_session posts → normalized run arrays
RunFilter          applies list/stats filters (status, mode, browser, os, dates) and sorting
CourseEditor       reads/writes the course option through CourseOrderSanitizer; describes entries
RunOutcome (Content) shared end-reason mapping, used by SessionDetail (refactor) and the abilities
```

### `includes/Abilities/Ability.php` (interface)

```php
interface Ability {
	public function name(): string;
	public function definition(): array;   // keys: label, description, input_schema, output_schema, annotations
	public function execute( array $input ): array|\WP_Error;
}
```

`definition()` is built fresh on each call (it calls `__()`), like `CourseOrderOption::definition()`.

### `includes/Abilities/AbilityRegistry.php` (implements `Manager`)

Constructor: `string $category, CapabilityInterface $capability, array $abilities` (list of `Ability`).

- `register(): void` — `add_action( 'wp_abilities_api_categories_init', array( $this, 'register_category' ) )`; `add_action( 'wp_abilities_api_init', array( $this, 'register_abilities' ) )`.
- `register_category(): void` — `wp_register_ability_category( $this->category, array( 'label' => …, 'description' => … ) )` (verbatim below).
- `register_abilities(): void` — for each ability: `wp_register_ability( $ability->name(), $args )` where `$args` =
  ```php
  array(
  	'label'               => $definition['label'],
  	'description'         => $definition['description'],
  	'category'            => $this->category,
  	'input_schema'        => $definition['input_schema'],
  	'output_schema'       => $definition['output_schema'],
  	'execute_callback'    => array( $ability, 'execute' ),
  	'permission_callback' => array( $this, 'can_run' ),
  	'meta'                => array(
  		'annotations'  => $definition['annotations'],
  		'show_in_rest' => true,
  		'mcp'          => array( 'public' => true, 'type' => 'tool' ),
  	),
  )
  ```
- `can_run(): bool` — `return $this->capability->allows();` (the input argument core passes is ignored; declare no parameter or a `mixed $input = null` one — core passes one argument when a schema exists; PHP allows extra args to userland callables, so a zero-parameter method is fine).

Wire in `Services.php`:
```php
AbilityRegistry::class => array(
	'args' => array(
		'category'   => '%abilities.category%',
		'capability' => Capability::class,
		'abilities'  => array( 'services' => array( ListRuns::class, GetRun::class, GetRunReadings::class, CompareRuns::class, GetDrainStats::class, TrashRuns::class, RestoreRuns::class, GetCockpitLink::class, GetCourse::class, FindPages::class, AddCoursePage::class, MoveCoursePage::class, RemoveCoursePage::class, ResetCourse::class ) ),
	),
),
```
plus recipes for the shared classes below (follow how `OptionRegistry`'s `providers` and other recipes are written; run `composer validate:container`). Add `AbilityRegistry::class` to `BatterySurfBench::MANAGERS` after `SessionDetail::class`. Add to `Config.php`:
```php
'abilities'  => array(
	// Ability category every Battery Surf Bench ability is filed under, and the
	// namespace segment of every ability name (`battery-surf-bench/list-runs`).
	'category' => 'battery-surf-bench',
),
```
Ability names use the literal prefix `battery-surf-bench/` (a class constant `NAME` in each class is fine).

### `includes/Content/RunOutcome.php`

`final class RunOutcome` with `public static function reason( string $status, string $config_mode ): string` returning the cockpit end-reason key exactly as `SessionDetail::end_reason()` computes it today (`stopped`→`stopped`, `aborted`→`plugged`, `failed`→`loadError`, otherwise `targetDrop` when `$config_mode === 'targetDrop'`, else `duration`). Refactor `SessionDetail::end_reason()` to delegate to it (keep `SessionDetail` behaviour and its tests identical). Unit-test `RunOutcome`.

### `includes/Abilities/SessionReader.php`

Constructor: `string $post_type, string $meta_prefix, string $detail_slug, string $detail_param` (tokens `%session.post_type%`, `%session.meta_prefix%`, `%session.detail_slug%`, `%session.detail_param%`).

Public methods:
- `all( string $status = 'publish' ): array` — every session with that post status (`'publish'` for the recorded runs, `'trash'` for the trashed ones) as a normalized run (shape below), unsorted. Implementation: loop `get_posts( array( 'post_type' => $post_type, 'post_status' => $status, 'posts_per_page' => 100, 'paged' => $page, 'orderby' => 'ID', 'order' => 'ASC', 'fields' => 'ids', 'no_found_rows' => true ) )` from page 1 until a page returns fewer than 100 ids; normalize each id.
- `find( int $id ): ?array` — the normalized run, or null when the id is not a published post of the session type (`get_post()` + type + `publish` check).
- `find_trashed( int $id ): ?array` — the same for a session post in `trash` status (revision 1: lets runs come back from the trash). Every other ability keeps reading published runs only.
- `readings( int $id ): array` — the run's readings (shape below), in stored order.
- `newest(): ?array` — the run with the latest `started_at` (ties → higher id); null when none.

Normalized run (`detail` shape; this exact key order):
```
id                               int
status                           string   stored bsbench_status (finished|stopped|aborted|failed|running)
end_reason                       string|null  RunOutcome::reason(), or null when status is 'running'
outcome                          string   sentence for end_reason (verbatim table below), or the running sentence
mode                             string   stored bsbench_mode (duration|target)
started_at                       string|null  ISO 8601 in the site timezone: wp_date( 'c', $ts ); null when the meta is empty/unparseable
ended_at                         string|null  same
elapsed_seconds                  int
battery_start_percent            float    round( start_level * 100, 2 )
battery_end_percent              float    round( end_level * 100, 2 )
battery_drop_points              float    round( (float) dropped_pct, 2 )
drain_rate_session_pct_per_hour  float|null  rate_session, null when <= 0
drain_rate_10min_pct_per_hour    float|null  rate_10, null when <= 0
projected_full_runtime_seconds   int|null    time_to_empty, null when <= 0
setup                            object  { duration_seconds: int|null (config_duration, null when meta empty or mode isn't duration), stop_at_battery_percent: int|null (config_target_percent, null when meta empty or mode isn't targetDrop) } — chosen by the stored config mode, which is not repeated here (revision 1: it duplicated the top-level `mode` under another name)
browser                          object  { name: string|null, version: string|null, os: string|null } — '' → null
reading_count                    int     count of stored samples
report_url                       string  admin_url( 'admin.php?page=' . $detail_slug . '&' . $detail_param . '=' . $id )
```
Timestamps: parse `bsbench_started_at` / `bsbench_ended_at` (UTC ISO strings like `2026-11-24T09:30:00.000Z`) with `strtotime()`; an empty meta or a `false` parse → null. `RunFilter` and `newest()` get a run's start moment by parsing its `started_at` output back with `strtotime()` (an ISO string with an offset round-trips exactly); a null `started_at` counts as 0 for sorting and never matches a date filter.

Readings shape: list of `{ elapsed_seconds: float (round( t / 1000, 1 )), battery_percent: float (round( level * 100, 2 )), charging: bool, repeat_count: int }`.

Outcome sentences (`__()`), keyed by end reason — VERBATIM:

<<<VERBATIM file=includes/Abilities/SessionReader.php section="outcome sentences">>>
duration   => Finished: it ran for its full set duration.
targetDrop => Finished: the battery fell to the level the run was set to stop at.
stopped    => Cut short: it was stopped by hand before it finished.
plugged    => Cut short: a charger was plugged in, which ended the run.
loadError  => Failed: a course page didn't load, so the run stopped.
running    => Still in progress: the run hasn't reported its end yet.
<<<END VERBATIM>>>
(Each right-hand side is the exact string passed to `__()`; the left is the key.)

### `includes/Abilities/RunFilter.php`

Pure logic, no WordPress calls except `wp_timezone()` and `rest_parse_date()`.

- `filter( array $runs, array $input ): array|WP_Error` — keeps runs matching every given criterion:
  - `status` (string[]): run status in list.
  - `mode` (string[]): run mode in list.
  - `browser` (string): case-insensitive substring of `browser.name` (`stripos`); a null name never matches.
  - `os` (string): same, on `browser.os`.
  - `started_after` (string): run start timestamp `>=` boundary. `started_before` (string): `<` boundary. A run with null `started_at` never matches a date filter.
  - Date parsing (`parse_date( string $value ): int|WP_Error`, public): `YYYY-MM-DD` → midnight of that day in `wp_timezone()`; otherwise `rest_parse_date( $value )` (RFC 3339 date-time); `false` → `WP_Error( 'bsbench_invalid_date', <msg>, array( 'status' => 400 ) )`.
- `sort( array $runs, string $order_by, string $order ): array` — `order_by` ∈ `started_at` (start timestamp), `drain_rate_session`, `drain_rate_10min`, `battery_drop`, `elapsed`, `projected_runtime` (mapping to the run keys `drain_rate_session_pct_per_hour`, `drain_rate_10min_pct_per_hour`, `battery_drop_points`, `elapsed_seconds`, `projected_full_runtime_seconds`). Numeric comparison. **Null values always sort last** regardless of direction. Ties → higher id first for `desc`, lower id first for `asc`. Stable.

### `includes/Abilities/CourseEditor.php`

Constructor: `string $option_name, CourseOrderSanitizer $sanitizer, CourseCatalog $catalog`.

- `entries(): array` — `$this->sanitizer->sanitize( get_option( $this->option_name, $this->sanitizer->default_order() ) )`.
- `save( array $entries ): array` — `update_option( $this->option_name, $entries )` then return `entries()` (re-read; `register_setting`'s sanitize callback runs on update).
- `describe( array $entries ): array` — the `pages` list for outputs: per entry, `{ position: int (1-based), kind: 'bundled'|'user', slug: string|null, post_id: int|null, title: string, post_type: string|null, url: string|null }`. Bundled: title from `CourseCatalog::titles()`, `post_type`/`url`/`post_id` null. User: `title` = `html_entity_decode( (string) get_post_field( 'post_title', $id ), ENT_QUOTES, 'UTF-8' )` (the stored title, without WordPress's "Private: " / "Protected: " display prefixes; the same title is used by find-pages and every error message), `post_type` = `get_post_type( $id )`, `url` = `get_permalink( $id )`, `slug` null.
- `bundled(): array` — `{ slug, title, in_course: bool }` for every catalog page, given the current entries (signature `bundled( array $entries ): array`).
- `is_default( array $entries ): bool` — entries equal `default_order()`.
- `position_of( array $entries, ?int $post_id, ?string $slug ): ?int` — 1-based position or null.
- `eligibility( int $post_id ): true|WP_Error` — mirrors the sanitizer's rule with explicit reasons: not found (`get_post()` null or post type not one of `%settings.post_types%`… see below) / not published / not publicly viewable. Inject `array $selectable_post_types` (token `%settings.post_types%`) too.

Add to `CourseCatalog`: `public function titles(): array` — returns the `PAGES` slug ⇒ title map without loading markup. Unit-test it; add to the chart.

`CourseEditor`'s public API is exactly the methods above. What the six course abilities share beyond it (the output shape below, the `post_id` / `bundled_slug` input and its "exactly one" check, the position lookup, and the builders of the shared error messages) lives in the abstract `CourseAbility` base they extend, as protected helpers; `ResetCourse` also takes the `CourseOrderSanitizer` for the default order, and `FindPages` also takes the post types (revision 1).

### Course-ability output shape (shared by get-course and every course write)

```
{ pages: [ describe() items ], page_count: int, is_default: bool, bundled_pages: [ bundled() items ] }
```
Writes additionally include their own top-level keys listed per ability.

## The 14 abilities (classes in `includes/Abilities/`, one file each)

Common: every class implements `Ability`, constructor-injects only what it needs (`SessionReader`, `RunFilter`, `CourseEditor`, `CourseCatalog`, strings), and returns arrays matching its `output_schema`. Annotation sets:
- READ: `array( 'readonly' => true, 'destructive' => false, 'idempotent' => true )`
- WRITE: `array( 'readonly' => false, 'destructive' => false, 'idempotent' => false )`
- RESET: `array( 'readonly' => false, 'destructive' => true, 'idempotent' => true )`
- TRASH: `array( 'readonly' => false, 'destructive' => true, 'idempotent' => false )`

Run summary shape (used by list-runs): the normalized run **minus** `reading_count` (i.e. id, status, end_reason, outcome, mode, started_at, ended_at, elapsed_seconds, battery_start_percent, battery_end_percent, battery_drop_points, the two rates, projected_full_runtime_seconds, setup, browser, report_url). It keeps `setup` so stop levels and set durations need no second call (revision 1).
Run detail shape (get-run, compare-runs, trash-runs' `trashed` items): the full normalized run.

Define the output schemas in one place: a `RunSchema` class (`includes/Abilities/RunSchema.php`) with public static `summary(): array`, `detail(): array`, `reading(): array`, `course(): array`, `filters(): array` (the shared filter input properties). Property `description`s inside output schemas are not needed; input property descriptions are (verbatim below).

`now` / `timezone` fields: `now` = `wp_date( 'c' )`, `timezone` = `wp_timezone_string()`.

| # | Class / name | Kind | Input (all optional unless marked) | Output |
|---|---|---|---|---|
| 1 | `ListRuns` `battery-surf-bench/list-runs` | READ | filters (`status` string[] enum finished/stopped/aborted/failed/running, `mode` string[] enum duration/target, `browser` string, `os` string, `started_after` string, `started_before` string) + `order_by` enum (default `started_at`) + `order` enum asc/desc (default `desc`) + `limit` int 1–100 (default 20) + `offset` int ≥ 0 (default 0) + `in_trash` boolean (default false; when true it lists the runs in the trash instead of the published ones, through the same filters, sort and output shape) | `{ now, timezone, total: int (matches before limit), returned: int, runs: summary[] }` |
| 2 | `GetRun` `battery-surf-bench/get-run` | READ | `id` int ≥ 1; omitted → newest | detail. Errors: none recorded → `bsbench_no_runs` 404; unknown id → `bsbench_run_not_found` 404 |
| 3 | `GetRunReadings` `battery-surf-bench/get-run-readings` | READ | `id` int ≥ 1 **required** | `{ id, reading_count, readings: reading[] }`; unknown id → `bsbench_run_not_found` 404 |
| 4 | `CompareRuns` `battery-surf-bench/compare-runs` | READ | `ids` int[] **required**, minItems 2, maxItems 10, uniqueItems | `{ runs: detail[] }` in the given order; any unknown ids → `bsbench_compare_not_found` 404 naming all of them |
| 5 | `GetDrainStats` `battery-surf-bench/get-drain-stats` | READ | filters (as #1; `status` default `['finished']` when omitted) | `{ now, timezone, filters_applied: object (the effective filters incl. default status), runs_matched: int, runs_measured: int, unmeasured_run_ids: int[], average_drain_rate_session_pct_per_hour: float\|null (mean over runs with a non-null session rate, round 1), average_drain_rate_10min_pct_per_hour: float\|null (mean over non-null, round 1), average_projected_full_runtime_seconds: int\|null (mean over non-null, round to int), average_battery_drop_points: float\|null (mean over the measured runs, round 2), total_elapsed_seconds: int (sum over all matched runs), fastest_drain: {id, drain_rate_session_pct_per_hour}\|null, slowest_drain: same\|null }` — "measured" = non-null session rate; fastest/slowest by session rate among measured; ties → lower id |
| 6 | `TrashRuns` `battery-surf-bench/trash-runs` | TRASH | `ids` int[] **required**, minItems 1, maxItems 100, uniqueItems | validate every id first with `SessionReader::find()`; any unknown → `bsbench_trash_not_found` 404 naming them, nothing trashed. Else `wp_trash_post()` each; a `false`/`null` result → `bsbench_trash_failed` 500. Output `{ trashed_count: int, trashed: detail[] (as they were before trashing) }` |
| 6a | `RestoreRuns` `battery-surf-bench/restore-runs` | WRITE | `ids` int[] **required**, items ≥ 1, minItems 1, maxItems 100, uniqueItems | validate every id first with `SessionReader::find_trashed()`; any that isn't a trashed run → `bsbench_restore_not_found` 404 naming them, nothing restored. Else, with `wp_untrash_post_set_previous_status` added to the `wp_untrash_post_status` filter (priority 10, 3 args) for the duration of the call and removed after (so a run goes back to `publish`, not core's default `draft`), `wp_untrash_post()` each; a falsy result → `bsbench_restore_failed` 500. Output `{ restored_count: int, restored: detail[] (read after restoring) }` |
| 7 | `GetCockpitLink` `battery-surf-bench/get-cockpit-link` | READ | none (empty object schema with default) | `{ cockpit_url: add_query_arg( %cockpit.param%, %cockpit.value%, home_url( '/' ) ), sessions_url: admin_url( 'admin.php?page=' . %session.screen_slug% ), requirements: string[] (verbatim) }` |
| 8 | `GetCourse` `battery-surf-bench/get-course` | READ | none | course shape |
| 9 | `FindPages` `battery-surf-bench/find-pages` | READ | `search` string, `limit` int 1–50 (default 20) | `{ pages: [ { post_id, title, post_type, status: string (post_status), url: string\|null (get_permalink, null if not publish), can_add: bool (eligibility() === true and not already in course), in_course: bool, reason: string\|null (eligibility error message, or the "already in course" message, or null) } ] }`. Query: `get_posts( array( 'post_type' => %settings.post_types%, 'post_status' => array( 'publish', 'draft', 'pending', 'private', 'future' ), 's' => $search (omit key when empty), 'posts_per_page' => $limit, 'orderby' => array( 'date' => 'DESC', 'ID' => 'DESC' ) )` (`'orderby' => 'relevance'` when searching; the ID tie-break keeps the list order stable) |
| 10 | `AddCoursePage` `battery-surf-bench/add-course-page` | WRITE | `post_id` int ≥ 1 \| `bundled_slug` string enum (catalog slugs from `titles()`), exactly one; `position` int ≥ 1 (default: append) | errors: neither/both → `bsbench_page_choice` 400; user page ineligible → the `eligibility()` error (400; 404 for not found); already in course → `bsbench_page_in_course` 409; position > page_count + 1 → `bsbench_position_out_of_range` 400. Insert, `save()`, then confirm the entry is at the requested position in the saved result, else `bsbench_course_not_saved` 500. Output course shape + `added: describe() item` |
| 11 | `MoveCoursePage` `battery-surf-bench/move-course-page` | WRITE | `post_id` \| `bundled_slug` (exactly one), `position` int ≥ 1 **required** | not in course → `bsbench_page_not_in_course` 404; position > page_count → `bsbench_position_out_of_range` 400. Output course shape + `moved: describe() item` |
| 12 | `RemoveCoursePage` `battery-surf-bench/remove-course-page` | WRITE | `post_id` \| `bundled_slug` (exactly one) | not in course → 404 as above; it's the only page → `bsbench_last_page` 409. Output course shape + `removed: describe() item (as it was)` |
| 13 | `ResetCourse` `battery-surf-bench/reset-course` | RESET | none | `save( default_order() )`; output course shape |

"Exactly one of post_id / bundled_slug" is checked in the execute callback (JSON-schema `oneOf` is not used). For error messages that name a page, the page's title is `describe()`'s title (bundled: catalog title).

## VERBATIM strings

All strings below go through `__()` with the `battery-surf-bench` text domain. `%s`/`%d` strings use `sprintf()` and carry the given `/* translators: */` comment.

### Category

<<<VERBATIM file=includes/Abilities/AbilityRegistry.php section="category">>>
label: Battery Surf Bench
description: Battery benchmark runs recorded on this site, and the course of pages the simulated surfer visits during a benchmark.
<<<END VERBATIM>>>

### Ability labels and descriptions

<<<VERBATIM file=includes/Abilities/*.php section="labels and descriptions">>>
battery-surf-bench/list-runs
label: List benchmark runs
description: Lists the battery benchmark runs recorded on this site, newest first unless you choose another order. Filter by status, run mode, browser, operating system or start date, and sort by drain rate, battery drop, length or projected runtime, for example to find the run that drained the battery fastest. Each run comes with its status, how it ended, its length, battery levels, drain rates and a link to its report. A drain rate or projection the run couldn't measure is null, and nulls always sort last. Dates are in the site's timezone, which the result reports along with the current time.

battery-surf-bench/get-run
label: Get a benchmark run
description: Returns one battery benchmark run in full: how it ended and why, its length, battery levels and drop, both drain rates, the projected full-battery runtime, the setup it ran with, the browser and operating system it ran on, and a link to its report in wp-admin. Leave out the id to get the newest run.

battery-surf-bench/get-run-readings
label: Get a run's battery readings
description: Returns the battery readings a benchmark run recorded, in order, ready to chart. Each reading marks the moment the battery reached a new level: the seconds since the run started, the battery level in percent, whether a charger was connected, and repeat_count, how many times the battery reported that same level before it changed.

battery-surf-bench/compare-runs
label: Compare benchmark runs
description: Returns two or more benchmark runs side by side, in the order you list them, each with its battery drop, both drain rates, projected full-battery runtime, length, setup, browser and how it ended.

battery-surf-bench/get-drain-stats
label: Get drain statistics
description: Averages the drain figures over a set of benchmark runs: finished runs by default, or the statuses, modes, browsers, operating system and dates you filter by. Runs whose drain rate couldn't be measured are counted but left out of the averages, and their ids are listed. Also names the runs with the fastest and the slowest whole-run drain rate.

battery-surf-bench/trash-runs
label: Move benchmark runs to the trash
description: Moves the benchmark runs with the given ids to the trash, which removes them from the Sessions screen and from every other ability until they're restored with battery-surf-bench/restore-runs. Find the runs with battery-surf-bench/list-runs, show them to the user and get their confirmation before calling this. If any id isn't a recorded run, nothing is moved.

battery-surf-bench/restore-runs
label: Restore benchmark runs from the trash
description: Brings benchmark runs back from the trash, so they show again on the Sessions screen and in every other ability. Find the runs in the trash with battery-surf-bench/list-runs and in_trash set to true. If any id isn't a run in the trash, nothing is restored.

battery-surf-bench/get-cockpit-link
label: Get the benchmark cockpit link
description: Returns the link to the cockpit, the dashboard where battery benchmarks run. A benchmark can't be started from here: it runs in the browser, so the user opens the link in a Chromium-based browser on the device being tested, unplugs the charger and presses start. Also returns the link to the Sessions screen, which lists every recorded run.

battery-surf-bench/get-course
label: Get the surf course
description: Returns the course: the pages the simulated surfer visits during a benchmark, in visit order. Each page is either bundled with the plugin, identified by its slug, or one of the site's own posts and pages, identified by its post id. Also lists every bundled page and whether it's in the course.

battery-surf-bench/find-pages
label: Find pages for the course
description: Searches the site's posts and pages by title, to add one to the course. Each result says whether it can be added and, if not, why: only published, public posts and pages can be in the course. Leave out the search to list the most recent ones.

battery-surf-bench/add-course-page
label: Add a page to the course
description: Adds a page to the course, at the end or at the position you give. Name one of the site's posts or pages by its post id (find it with battery-surf-bench/find-pages), or a bundled page by its slug (see battery-surf-bench/get-course). Only published, public posts and pages can be added: drafts, pending, scheduled and private ones are refused.

battery-surf-bench/move-course-page
label: Move a course page
description: Moves a page that's already in the course to a new position. Position 1 is the first page the surfer visits.

battery-surf-bench/remove-course-page
label: Remove a page from the course
description: Takes a page out of the course. The page itself stays on the site, and it can be added back at any time. The course always keeps at least one page.

battery-surf-bench/reset-course
label: Reset the course
description: Replaces the course with the default: the five bundled pages in their original order. The site's own posts and pages leave the course, but stay on the site.
<<<END VERBATIM>>>

### Input property descriptions

<<<VERBATIM file=includes/Abilities/RunSchema.php and ability classes section="input property descriptions">>>
status (list-runs, get-drain-stats): Only runs with one of these statuses. finished: the run completed its set duration or reached its target level. stopped: stopped by hand. aborted: ended because a charger was plugged in. failed: a course page didn't load. running: hasn't reported its end.
status (get-drain-stats only, appended sentence): Defaults to finished runs only.
mode: Only runs in one of these modes. duration: ran for a set length of time. target: ran until the battery fell to a set level.
browser: Only runs captured in a browser whose name contains this text, such as Chrome, Edge or Opera. Not case-sensitive.
os: Only runs captured on an operating system whose name contains this text, such as macOS or Windows. Not case-sensitive.
started_after: Only runs that started at or after this moment. A date (YYYY-MM-DD) means the start of that day in the site's timezone; a date and time needs an offset, such as 2026-11-24T09:30:00+01:00.
started_before: Only runs that started before this moment. A date (YYYY-MM-DD) means the start of that day in the site's timezone, so that day itself is left out.
order_by: What to sort the runs by. started_at: when they started. drain_rate_session: the whole-run drain rate. drain_rate_10min: the drain rate over the run's last 10 minutes. battery_drop: how many percentage points the battery fell. elapsed: how long they ran. projected_runtime: the projected full-battery runtime.
order: desc for highest or newest first, asc for lowest or oldest first. Runs with no value for the sort field always come last.
limit: How many runs to return, from 1 to 100.
offset: How many matching runs to skip, for paging through long lists.
id (get-run): The run's id. Leave it out to get the newest run.
id (get-run-readings): The run's id.
ids (compare-runs): The ids of the runs to compare, from 2 to 10.
ids (trash-runs): The ids of the runs to move to the trash.
ids (restore-runs): The ids of the trashed runs to restore.
in_trash (list-runs): Set to true to list the runs in the trash instead of the recorded ones, for example to find a run to restore.
search: Text to look for in post and page titles.
limit (find-pages): How many results to return, from 1 to 50.
post_id: The id of one of the site's posts or pages. Give this or bundled_slug, not both.
bundled_slug: The slug of a bundled page. Give this or post_id, not both.
position (add-course-page): Where to put the page, counting from 1. Leave it out to add the page at the end.
position (move-course-page): The page's new position, counting from 1.
<<<END VERBATIM>>>

### Cockpit requirements (get-cockpit-link `requirements`, in this order)

<<<VERBATIM file=includes/Abilities/GetCockpitLink.php section="requirements">>>
Open the link in a Chromium-based browser, such as Chrome, Edge or Opera: only these can read the battery level.
Use the device whose battery you want to test, signed in to this site as an administrator.
Unplug the charger first. A benchmark won't start while the device is charging, and plugging in during a run ends it.
Keep the cockpit tab open until the run ends. The run is saved as soon as it ends.
<<<END VERBATIM>>>

### Error messages

<<<VERBATIM file=includes/Abilities/*.php section="errors">>>
bsbench_no_runs: No benchmark runs have been recorded yet.
bsbench_run_not_found: /* translators: %d: A benchmark run id. */ There's no benchmark run with the id %d.
bsbench_compare_not_found: /* translators: %s: A comma-separated list of ids. */ These ids aren't recorded benchmark runs: %s.
bsbench_trash_not_found: /* translators: %s: A comma-separated list of ids. */ These ids aren't recorded benchmark runs: %s. Nothing was moved to the trash.
bsbench_restore_not_found: /* translators: %s: A comma-separated list of ids. */ These ids aren't runs in the trash: %s. Nothing was restored.
bsbench_restore_failed: /* translators: %d: A benchmark run id. */ The run with the id %d couldn't be restored. The runs before it in the list were restored.
bsbench_trash_failed: /* translators: %d: A benchmark run id. */ The run with the id %d couldn't be moved to the trash. The runs before it in the list were moved.
bsbench_invalid_date: /* translators: %s: The value that was given as a date. */ “%s” isn't a date. Use a date such as 2026-11-24, or a date and time with an offset, such as 2026-11-24T09:30:00+01:00.
bsbench_page_choice: Name exactly one page: a post_id or a bundled_slug.
bsbench_page_not_found: /* translators: %d: A post id. */ There's no post or page with the id %d.
bsbench_page_wrong_type: /* translators: %s: A post title. */ “%s” can't be in the course: only posts and pages can.
bsbench_page_private: /* translators: %s: A post title. */ “%s” can't be in the course because it's private. Only published, public posts and pages can be in the course.
bsbench_page_not_published: /* translators: 1: A post title. 2: The post's status, such as draft or private. */ “%1$s” can't be in the course because it isn't published (its status is %2$s). Only published, public posts and pages can be in the course.
bsbench_page_not_public: /* translators: %s: A post title. */ “%s” can't be in the course because visitors can't view it. Only published, public posts and pages can be in the course.
bsbench_page_in_course: /* translators: 1: A page title. 2: Its position in the course. */ “%1$s” is already in the course, at position %2$d.
bsbench_page_not_in_course: /* translators: %s: A page title, or a post id. */ “%s” isn't in the course.
bsbench_position_out_of_range: /* translators: 1: The position that was given. 2: The highest position allowed. */ Position %1$d is out of range: choose a position from 1 to %2$d.
bsbench_last_page: The course needs at least one page, so its only page can't be removed.
bsbench_course_not_saved: The course couldn't be saved.
<<<END VERBATIM>>>
Notes: `bsbench_page_not_in_course` with a `post_id` that doesn't exist at all uses the id as text (`(string) $id`). Ids lists are joined with `', '`. `bsbench_page_wrong_type` / `private` / `not_published` / `not_public` are returned by `CourseEditor::eligibility()` in that check order (not found → 404, the others → 400); a post whose status is `private` gets `bsbench_page_private`, other non-`publish` statuses `bsbench_page_not_published`. The FindPages `reason` field is the message text of the eligibility error, or of `bsbench_page_in_course` when it's already in the course.

## Dev-only agent playground

Files: `wp-playground/StartAgent.mts` (new), `wp-playground/AgentSeed.mts` (new, exports the seed PHP source string), additions to `wp-playground/blueprint.mts` and `wp-playground/config.mts`, `package.json`, `composer.json`, `.gitignore`.

- `config.mts`: `export const PLAYGROUND_AGENT_PORT = 9900;` with a doc comment in the style of the other ports, and `export const AGENT_CREDENTIALS_DIR` = absolute path of `wp-playground/.agent` (resolve from the file's dirname like other paths there) plus `AGENT_CREDENTIALS_VFS_PATH = '/agent'`.
- `blueprint.mts`:
  - `export const mcpAdapterStep` — the `installPlugin` url step for `https://downloads.wordpress.org/plugin/mcp-adapter.0.7.2.zip` (pinned; doc comment says why pinned and that it is the official MCP Adapter from WordPress.org; `options: { activate: true }` if the step type supports it, otherwise follow with `activatePlugin` `mcp-adapter/mcp-adapter.php`).
  - `export const agentAccessMuPlugin` + `agentAccessStep()` — mu-plugin `bsb-agent-access.php`: `add_filter( 'wp_is_application_passwords_available', '__return_true' );` with a header comment like the other mu-plugins (dev-only, why: application passwords need HTTPS or a `local` environment and the playground serves plain HTTP in `development`).
  - `export const agentBlueprint: BlueprintDeclaration` — `...base`, steps: `debugStep`, `siteLanguageStep`, `setSiteOptions { timezone_string: 'Europe/Berlin', blogname: 'Battery Lab' }`, `activatePluginStep`, `mcpAdapterStep`, `autoLoginStep()`, `youtubeOembedStubStep()`, `agentAccessStep()`, then `{ step: 'runPHP', code: agentSeedPhp }`.
  - Add `mcpAdapterStep` to `e2eBlueprint` (after `activatePluginStep`) — the e2e spec drives the MCP endpoint. Not to the unauth blueprint.
- `AgentSeed.mts`: `export const agentSeedPhp` = PHP source that:
  1. `require_once '/wordpress/wp-load.php';` sets the current user to `admin`.
  2. Creates pages/posts with `wp_insert_post()` (content `<!-- wp:paragraph --><p>Placeholder content for the agent playground.</p><!-- /wp:paragraph -->`):
     - page "About" publish; page "Contact" publish; page "Pricing" draft; page "Team Notes" private; post "Battery Myths, Busted" publish; post "Coming Soon: Our Spring Tour" future (post_date = now + 10 days, site time).
  3. Creates the 24 runs below **through REST**: `rest_do_request()` with a `WP_REST_Request( 'POST', '/wp/v2/bsbench_session' )` whose JSON body params are `status: publish`, `date_gmt` = the run's end time (UTC, `gmdate( 'Y-m-d\TH:i:s' )`), and `meta` (all `bsbench_*` keys exactly as `src/cockpit/SessionUpload.ts` builds them). If any response is an error, `throw new RuntimeException()` with its message so the boot fails loudly.
  4. Saves the course with `update_option( 'bsbench_course_order', … )`: bundled `article-1`, `gallery`, `article-2`, `video`, `links`, then user `Contact`.
  5. Creates an application password named `Agent playground` for `admin` with `WP_Application_Passwords::create_new_application_password()`, and writes `/agent/credentials.json` with `json_encode( array( 'username' => 'admin', 'password' => $password ) )` (raw PHP file write is fine here: dev-only Playground code, not plugin code).

  Run generation: `$now = time()`; for each row, `start = $now - (int) round( days_ago * DAY_IN_SECONDS )` rounded down to the minute; `end = start + elapsed`. Meta:
  - `bsbench_status`, `bsbench_mode` (`duration` → `duration`, `targetDrop` → `target`), `bsbench_config_mode`, and `bsbench_config_duration` (= minutes × 60) for duration runs **or** `bsbench_config_target_percent` for targetDrop runs (never both).
  - `bsbench_started_at` / `bsbench_ended_at` = `gmdate( 'Y-m-d\TH:i:s.000\Z', … )`.
  - `bsbench_start_level` / `bsbench_end_level` = the levels; `bsbench_dropped_pct` = round( ( start − end ) × 100, 2 ); `bsbench_elapsed`; `bsbench_rate_session`, `bsbench_rate_10`, `bsbench_time_to_empty` as given (0 = unmeasured).
  - `bsbench_ua_browser`, `bsbench_ua_version`, `bsbench_ua_os`.
  - `bsbench_samples`: one plateau per whole percent from start down to end, evenly spaced over elapsed: for k = 0..n (n = round((start−end)×100)), `t` = round( k × elapsed × 1000 / max(n,1) ), `level` = round( start − k/100, 2 ), `charging` false, `count` = 3. For `aborted` rows append one final plateau `{ t: elapsed*1000, level: end, charging: true, count: 1 }`. For n = 0 runs: two plateaus `{0, start, false, 2}` and `{ elapsed*1000, start, false, 1 }`.

  Rows, inserted in this order (run 24 is inserted last on purpose although it started earlier):

  | # | days_ago | status | config_mode | min / target | elapsed s | start | end | rate_session | rate_10 | tte s | browser | version | os |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|---|
  | 1 | 29.2 | finished | duration | 60 | 3600 | 0.98 | 0.88 | 10.0 | 10.4 | 36000 | Chrome | 142 | macOS |
  | 2 | 27.5 | finished | duration | 30 | 1800 | 0.91 | 0.86 | 9.5 | 9.8 | 37895 | Edge | 141 | Windows |
  | 3 | 26.1 | stopped | duration | 120 | 2460 | 0.80 | 0.73 | 10.2 | 11.0 | 35294 | Chrome | 142 | macOS |
  | 4 | 24.0 | finished | targetDrop | 70 | 4320 | 0.85 | 0.70 | 12.5 | 12.9 | 28800 | Opera | 124 | Windows |
  | 5 | 22.3 | failed | duration | 60 | 95 | 0.77 | 0.77 | 0 | 0 | 0 | Chrome | 142 | Linux |
  | 6 | 20.9 | finished | duration | 45 | 2700 | 0.99 | 0.91 | 10.7 | 10.1 | 33645 | Edge | 142 | Windows |
  | 7 | 19.4 | aborted | targetDrop | 50 | 1500 | 0.66 | 0.62 | 9.6 | 9.9 | 37500 | Chrome | 143 | macOS |
  | 8 | 17.8 | finished | duration | 15 | 900 | 0.95 | 0.94 | 0 | 0 | 0 | Chrome | 143 | macOS |
  | 9 | 16.2 | finished | duration | 90 | 5400 | 0.97 | 0.79 | 12.0 | 12.3 | 30000 | Edge | 142 | Windows |
  | 10 | 14.6 | stopped | targetDrop | 40 | 600 | 0.60 | 0.59 | 0 | 0 | 0 | Chrome | 143 | ChromeOS |
  | 11 | 13.1 | finished | duration | 60 | 3600 | 0.92 | 0.82 | 9.8 | 10.6 | 36735 | Chrome | 143 | macOS |
  | 12 | 11.7 | failed | targetDrop | 60 | 40 | 0.88 | 0.88 | 0 | 0 | 0 | Edge | 142 | Windows |
  | 13 | 10.3 | finished | targetDrop | 75 | 3240 | 0.95 | 0.75 | 22.2 | 23.5 | 16216 | Chrome | 143 | Windows |
  | 14 | 9.0 | finished | duration | 30 | 1800 | 0.70 | 0.65 | 10.0 | 10.0 | 36000 | Opera | 125 | Windows |
  | 15 | 8.2 | aborted | duration | 60 | 1320 | 0.58 | 0.55 | 8.2 | 8.5 | 43902 | Edge | 143 | Windows |
  | 16 | 7.4 | finished | duration | 120 | 7200 | 0.99 | 0.77 | 11.0 | 11.4 | 32727 | Chrome | 143 | macOS |
  | 17 | 6.6 | stopped | duration | 60 | 1980 | 0.90 | 0.84 | 10.9 | 12.1 | 33028 | Chrome | 144 | macOS |
  | 18 | 5.3 | finished | targetDrop | 80 | 2880 | 0.96 | 0.80 | 20.0 | 19.4 | 18000 | Edge | 143 | Windows |
  | 19 | 4.1 | failed | duration | 30 | 210 | 0.71 | 0.70 | 0 | 0 | 0 | Chrome | 144 | Linux |
  | 20 | 3.2 | finished | duration | 60 | 3600 | 0.88 | 0.78 | 10.0 | 9.7 | 36000 | Chrome | 144 | macOS |
  | 21 | 2.0 | finished | duration | 45 | 2700 | 0.93 | 0.85 | 10.7 | 11.3 | 33645 | Edge | 144 | Windows |
  | 22 | 1.1 | aborted | targetDrop | 60 | 900 | 0.74 | 0.72 | 8.0 | 8.0 | 45000 | Opera | 125 | Windows |
  | 23 | 0.4 | finished | duration | 30 | 1800 | 0.97 | 0.92 | 10.0 | 10.3 | 36000 | Chrome | 144 | macOS |
  | 24 | 12.4 | finished | duration | 60 | 3600 | 0.89 | 0.79 | 10.0 | 10.2 | 36000 | Opera | 124 | Windows |

- `StartAgent.mts`: `mkdirSync( AGENT_CREDENTIALS_DIR, { recursive: true } )`, delete a stale `credentials.json`, resolve the port from `PLAYGROUND_AGENT_PORT`, start with `startTestServer()` extended by an optional `extraMounts` option (add it to `start-test-server.mts`: an array appended to `mount`), mounting `AGENT_CREDENTIALS_DIR` → `/agent`. After it is ready, read `credentials.json` and print the block below (computing `<endpoint>` = `<url>/wp-json/mcp/mcp-adapter-default-server` and `<basic>` = base64 of `username:password`), then write `wp-playground/.agent/mcp.json` with `{ "mcpServers": { "battery-surf-bench": { "type": "http", "url": "<endpoint>", "headers": { "Authorization": "Basic <basic>" } } } }`.
- `.gitignore`: add, after the `.livereload-port` lines:
  ```
  # Agent playground credentials, written by StartAgent.mts each run
  wp-playground/.agent/
  ```
- `package.json` script: `"playground:agent": "tsx wp-playground/StartAgent.mts"`.
- `composer.json` script `"serve:agent": [ "pnpm run assets:development", "pnpm run playground:agent" ]` with description (verbatim below).

<<<VERBATIM file=wp-playground/StartAgent.mts section="ready output">>>
  Agent playground: 24 seeded benchmark runs, a few pages to try in the course, and the MCP Adapter.
  It starts fresh every time, so anything an agent changes is gone on the next start.

  MCP endpoint:          <endpoint>
  Username:              admin
  Application password:  <password>

  Connect Claude Code:
    claude mcp add --transport http battery-surf-bench <endpoint> --header "Authorization: Basic <basic>"

  Or point any MCP client at wp-playground/.agent/mcp.json.
<<<END VERBATIM>>>

<<<VERBATIM file=composer.json section="scripts-descriptions.serve:agent">>>
Serve a fresh Playground site for AI agents: seeded runs, the MCP Adapter and an application password.
<<<END VERBATIM>>>

## Documentation

<<<VERBATIM file=readme.txt section="new Description subsection, inserted directly before '= Private by design ='">>>
= Ask your AI assistant =

Battery Surf Bench works with AI agents through the WordPress Abilities API. Connect an assistant such as Claude to your site with the MCP Adapter plugin, and ask it in your own words: "How did my last battery benchmark go?", "Which run drained the battery fastest?", "Compare my Chrome run with my Edge run", or "Add my About page to the course".

* **Your runs, on request.** The assistant can list and filter your runs, explain how one ended, average your drain rates, compare runs side by side, and chart a run's battery readings.
* **The course, in plain words.** Add, move or remove the pages the surfer visits, or reset the course to the bundled pages.
* **Tidying up.** Ask it to clear out your failed runs, and it shows you which runs before moving them to the trash.
* **The same gate as the screens.** Every ability needs the `manage_options` capability, like the plugin's own screens, so an assistant can do only what its signed-in account can.

The benchmark itself still runs in your browser. When you ask for one, the assistant gives you the cockpit link, because only a Chromium browser on the device being tested can read its battery.
<<<END VERBATIM>>>

<<<VERBATIM file=readme.txt section="new FAQ entry, appended after the last FAQ entry ('Why is there a YouTube video in the surf course?')">>>
= Can an AI assistant use Battery Surf Bench? =

Yes. The plugin registers its abilities with the WordPress Abilities API, which is part of WordPress. Install the MCP Adapter plugin from WordPress.org, create an application password for an administrator, and connect your assistant to the site as the MCP Adapter's documentation describes. The assistant can then read your runs, change the course and tidy up old runs, under the same `manage_options` gate as the plugin's own screens. The plugin itself contacts no AI service: your data reaches only the assistant you connect.
<<<END VERBATIM>>>

<<<VERBATIM file=readme.txt section="changelog: new '= Unreleased =' heading directly under '== Changelog ==', above '= 1.1.0 ='">>>
= Unreleased =
* New: AI assistants can read your benchmark runs, compare and average them, and manage the surf course through the WordPress Abilities API and the MCP Adapter plugin.
* Fix: the readme now says what plugging in mid-run does: it ends the run, which is saved as interrupted.
<<<END VERBATIM>>>

<<<VERBATIM file=README.md section="new section, inserted directly before '## Private by design'">>>
## Ask your AI assistant

Battery Surf Bench works with AI agents through the WordPress Abilities API. Connect an assistant such as Claude to your site with the [MCP Adapter](https://wordpress.org/plugins/mcp-adapter/) plugin, and ask it in your own words: "How did my last battery benchmark go?", "Which run drained the battery fastest?", "Compare my Chrome run with my Edge run", or "Add my About page to the course".

- **Your runs, on request.** List and filter runs, find out how one ended, average drain rates, compare runs side by side, and chart a run's battery readings.
- **The course, in plain words.** Add, move or remove the pages the surfer visits, or reset the course to the bundled pages.
- **Tidying up.** Clear out failed runs: the assistant shows you which runs before moving them to the trash.
- **The same gate as the screens.** Every ability needs the `manage_options` capability, so an assistant can do only what its signed-in account can.

The benchmark itself still runs in your browser: the assistant hands you the cockpit link, because only a Chromium browser on the device being tested can read its battery.

To try it locally, `composer serve:agent` starts a fresh Playground site with seeded runs and the MCP Adapter, and prints the command that connects Claude Code to it.
<<<END VERBATIM>>>

<<<VERBATIM file=CLAUDE.md section="new bullet in 'Builds, Zips and Servers — Start From Composer', appended after the 'composer serve:development' bullet">>>
- **`composer serve:agent`** builds the development bundles and starts a fresh Playground site for AI agents: the MCP Adapter plugin, 24 seeded benchmark runs, a few pages for the course, and an application password. It prints the MCP endpoint and the `claude mcp add` command that connects to it, and writes the same connection to `wp-playground/.agent/mcp.json`. The seed lives in `wp-playground/AgentSeed.mts`.
<<<END VERBATIM>>>

## Charger-aware bullet (revision 1)

Both readmes' "Charger-aware" bullet said a charger pauses and resumes the run; the cockpit ends it (`stopRun( …, 'plugged' )`). The bullet now reads: "a benchmark won't start while you're plugged in, and plugging the charger in mid-run ends the run. It's saved as interrupted, so charging time never counts toward the drain."

## Contract chart (`docs/contracts/php-class-interactions.mmd`)

Add classes with their public methods: `Ability` (`<<interface>>`), `AbilityRegistry`, `SessionReader`, `RunFilter`, `RunSchema` (`<<utility>>`), `CourseEditor`, `RunOutcome` (`<<utility>>`), the 14 ability classes (each `+name() string`, `+definition() array`, `+execute(array input) array`), and `CourseCatalog +titles() array`. Relations: `AbilityRegistry ..|> Manager`, `AbilityRegistry --> Capability : gates via`, `AbilityRegistry o-- Ability : registers (aggregation)`, each ability `..|> Ability`, run abilities `--> SessionReader`, list/stats `--> RunFilter`, course abilities `--> CourseEditor`, `CourseEditor --> CourseOrderSanitizer`, `CourseEditor --> CourseCatalog`, `SessionReader ..> RunOutcome`, `SessionDetail ..> RunOutcome`, `Instantiator ..> AbilityRegistry : instantiates`, `BatterySurfBench ..> Manager` already covers registration. A `%%` comment explains that abilities register through the core Abilities API and the MCP Adapter, when installed, exposes them. Escape characters per CLAUDE.md; run `pnpm contracts:verify`.

## Tests

### PHPUnit (`tests/Abilities/…`, `tests/Content/RunOutcomeTest.php`, extend `CourseCatalogTest`)

- `AbilityRegistryTest`: registers the two actions; `register_category()` calls `wp_register_ability_category` with the slug and translated label/description; `register_abilities()` calls `wp_register_ability` once per ability with name, category, `execute_callback === [ $ability, 'execute' ]`, `permission_callback`, `meta.show_in_rest === true`, `meta.mcp.public === true`, `meta.annotations` from the definition; `can_run()` follows the capability (use `Tests\Support\FakeCapability`).
- `AbilityContractTest` (a data provider over all 14 abilities) checks the contract every ability keeps, and the ability behaviour tests are grouped by topic (`GetRunTest`, `ListRunsTest`, `GetDrainStatsTest`, `RunReadingsAndComparisonTest`, `TrashAndRestoreRunsTest`, `GetCockpitLinkTest`, `CourseAbilitiesTest`), reading through an in-memory `FakeSessionReader` and the real `CourseEditor` instead of mocks (revision 1). The contract: names are valid (`^[a-z0-9-]+/[a-z0-9-]+$`, `battery-surf-bench/` prefix); input schema is an object with `default` `[]` and `additionalProperties` false; annotations match the kind; execute behaviour with a mocked `SessionReader` / `CourseEditor` (Mockery) covering every branch and error code listed above, including: list-runs default limit 20 and `total` vs `returned`; get-run newest when id omitted; drain stats exclude unmeasured runs and list their ids, default `status` finished; trash validates all ids before trashing any; add refuses draft/private/not-found/duplicate/out-of-range, accepts a bundled slug; remove refuses the last page; reset saves the default order.
- `RunFilterTest`: each filter; date-only boundary in a non-UTC timezone (stub `wp_timezone()` to `new DateTimeZone( 'Europe/Berlin' )`); invalid date error; numeric (not lexical) sort — 9.5 < 12.5 < 22.2; nulls last both directions; tie-breaks.
- `SessionReaderTest`: normalization (zero → null, levels × 100, '' browser fields → null, setup fields per mode, report URL, outcome sentence per status, `running` → null end_reason); paging calls `get_posts` until a short page; `find()` rejects other post types and non-published; `find_trashed()` finds only trashed runs; `all( 'trash' )`; `newest()`.
- `CourseEditorTest`: describe() for bundled and user entries; eligibility() reasons in order; position_of(); save() re-reads.
- `RunOutcomeTest` and the existing `SessionDetailTest` still pass unchanged.

### e2e

- `tests/e2e/AgentAbilities.spec.mts` (authenticated project; mint the nonce as `SessionPersistence.spec.mts` does). Seed its own data: 3 sessions via `POST /wp-json/wp/v2/bsbench_session` with a unique browser name `E2E-Agent` (one finished measured at rate 9.5, one finished at 12.5, one failed unmeasured with zeros), and two pages via `/wp/v2/pages` (one `publish` "E2E Agent Page", one `draft` "E2E Agent Draft"). Record the course option (`GET /wp/v2/settings` → `bsbench_course_order`) in `beforeAll` and restore it with `POST /wp/v2/settings` in `afterAll`. `test.describe.configure( { mode: 'serial' } )`. Cover:
  1. `GET /wp-json/wp-abilities/v1/abilities?category=battery-surf-bench` lists exactly the 14 names.
  2. `list-runs` (GET `…/abilities/battery-surf-bench/list-runs/run?input[browser]=E2E-Agent&input[order_by]=drain_rate_session`): order 12.5, 9.5, then the unmeasured run with null rate; `total` 3.
  3. `get-run` by id: fields match the seed (percent conversion, null rate, `report_url` contains `page=bsbench-session`).
  4. `get-drain-stats` with `browser=E2E-Agent` and `status[]=finished&status[]=failed`: average 11.0, `runs_measured` 2, `unmeasured_run_ids` = [failed id].
  5. `get-run-readings` returns readings with seconds.
  6. `compare-runs` with two ids keeps the order.
  7. Course: `find-pages` with `search=E2E Agent` reports `can_add` true/false with the not-published reason; `add-course-page` (POST) the published page at position 1 succeeds; adding the draft returns 400 with the `bsbench_page_not_published` code; `move-course-page` to the end; `remove-course-page`; `reset-course` (DELETE) gives `is_default: true`.
  8. `trash-runs` (POST) the failed run; afterwards `get-run` for it returns 404 `bsbench_run_not_found`, `list-runs` with `in_trash` lists it, `restore-runs` (POST) brings it back to `published` and `get-run` reads it again.
  9. MCP: `POST /wp-json/mcp/mcp-adapter-default-server` `initialize` (headers `X-WP-Nonce`, `Content-Type: application/json`, `Accept: application/json, text/event-stream`) → read `mcp-session-id`; `notifications/initialized`; `tools/call` `mcp-adapter-discover-abilities` lists `battery-surf-bench/get-run`; `tools/call` `mcp-adapter-execute-ability` with `{ ability_name: 'battery-surf-bench/get-run', parameters: { id } }` returns the seeded run's id inside the result (parse the text content JSON); `DELETE` the session.
- `tests/e2e/GatedAccess.unauth.spec.mts`: add that an anonymous `GET /wp-json/wp-abilities/v1/abilities/battery-surf-bench/list-runs/run` is refused (status 401) and `GET /wp-json/wp-abilities/v1/abilities` lists none of ours (401 or no `battery-surf-bench/` names — assert whichever core returns: run it and assert the real status).

## Done means

- `composer check; echo "EXIT=$?"` → 0; `pnpm test:e2e` and `pnpm test:e2e:unauth` pass locally; `composer zip:production` passes (package:verify).
- `composer serve:agent` boots, prints the block, and an MCP `tools/call` with the printed credentials works (curl it once and paste the output in your report).
- PR opened against `master`, title `[FEAT]: add AI agent abilities and MCP support`, body summarizing the change, CI green.
