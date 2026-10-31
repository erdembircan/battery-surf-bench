# CLAUDE.md

## WordPress APIs Move Fast — Verify Against Current Docs

This plugin leans on fast-moving, recently-changed WordPress APIs (Script Modules, the Interactivity API, Block Bindings, performant translations, the i18n stack). Your training data about WordPress is very likely **stale** — and so are many tutorials and even some official handbook pages (parts of which predate the current behavior).

Before implementing or advising on any WordPress-specific topic — especially i18n, script/asset registration, block registration, the Interactivity API, or anything tied to a `@since` version — **verify the current behavior against authoritative, up-to-date sources instead of relying on memory**:

- the official developer resources (developer.wordpress.org handbooks and reference), reading the `@since`/changelog notes;
- the README/repo of the relevant `@wordpress/*` JS package;
- the **actual installed source** — WordPress core under `wp-playground/wordpress/` and packages under `node_modules` — which is the ground truth for the versions this project runs on;
- recent make.wordpress.org/core posts for what changed between releases.

When a doc disagrees with the installed version, the installed version wins. Re-check periodically; what was true a year ago often is not.

## Prototype Repo

When the user refers to **"the prototype repo"** (or "the prototype"), they mean the GitHub repository [`erdembircan/battery-surf-bench_dep`](https://github.com/erdembircan/battery-surf-bench_dep) — a deprecated, archived vibe-coded prototype built to validate the idea before this repository existed. It is **not** maintained and should never be treated as the source of truth for the current architecture or contracts.

Its value is historical: it contains integration details and key insights about model behavior that were learned while prototyping. Consult it as background reference when those details are relevant, but always defer to this repository for anything authoritative.

## Knowledge Base

`docs/knowledge-base/` contains reference material used to inform the design and implementation of battery-surf-bench. Covers published battery-benchmark methodologies, real-user browsing behavior statistics, the battery drain-rate calculation and projection math, and the research-derived surfer behavior profile. This is background research — agents and contributors should consult it when making decisions about how the tool should behave.

## Implementation Plans

`docs/plans/` holds the implementation plans for features **currently being planned or built**. **Whenever a task, prompt, or discussion mentions a plan** — "the plan", "the dev-tools plan", "implement the plan" — check `docs/plans/` first and read the matching plan document in full before doing anything else. It is the authoritative design for that work: don't ask where the plan is, and don't re-derive or re-litigate decisions the plan already settles.

**A plan lives only until its feature merges.** Up to the merge, the plan is the source of truth and must be kept in sync with the work; once the feature is implemented and merged, **the code is the source of truth** and the plan file must be **deleted in that same PR** (or immediately after the merge). Never keep a plan for a shipped feature — a lingering plan invites future agents to treat a stale document as authoritative. Past plans remain recoverable through git history if ever needed.

## Architectural Charts

Charts in `docs/contracts/` are **contracts**, not implementation details. They define the authoritative picture of the application's architecture and the interactions between its modules. Treat them with the same weight as API contracts — they describe what the system is, not how it happens to be built right now.

### Content Rules

Charts show **contracts**, not internals:

- Show only **public APIs** — methods and properties that a class or module exposes to other modules
- **Never** include private methods, internal helpers, or implementation details
- Show **relationships**: associations, dependencies, composition, aggregation
- Show **hierarchy**: inheritance and interface implementation
- Mark **abstractions**: abstract classes and interfaces must be visually distinguished

### Keeping Charts Current

Charts must always reflect the current state of the software. Any change to the codebase that affects architecture, module interactions, data flow, or use case behavior **must** include a corresponding update to the relevant chart(s) in the same commit or PR. There are no exceptions — a chart that does not match the code is actively misleading.

Before closing out any implementation task, verify whether the change warrants a chart update. If it does and the chart has not been updated, the task is not done.

### Keeping Charts Parseable

A chart Mermaid cannot parse renders nowhere, which makes it as useless as a stale one. `pnpm contracts:verify` parses every `docs/contracts/*.mmd` file with the Mermaid version in the lockfile and prints Mermaid's own error for each chart that fails; CI runs it on every pull request and merge. Run it after any chart edit.

A few ordinary characters break Mermaid's grammar in specific places. Write them as Mermaid entity codes, which render as the character itself:

- **Relation labels** (the text after `A --> B :`): a further `:` as `#58;`, and `;` as `#59;`.
- **Sequence-diagram messages:** `;` as `#59;`.
- **Class bodies** (one member per line): `{` and `}` as `#123;` and `#125;`. On a line that starts with `(`, or that closes a parenthesis opened on an earlier line, also write `(` and `)` as `#40;` and `#41;`.

Mermaid numbers lines only after stripping a chart's `---` front matter and its `%%` comment lines, so the line numbers in its errors can run behind the file's.

## JSDoc & PHPDoc

Classes and functions must be documented — JSDoc for JS/TS code, PHPDoc for PHP code. Do **not** add doc comments to types or interfaces — the language makes them self-explanatory.

**TypeScript (JSDoc):** the TypeScript annotation already declares the type, so omit redundant `@param {type}` / `@returns {type}` annotations — descriptions only.

```ts
/**
 * Renders a question to the terminal using the Clack prompt library.
 *
 * @param question - The question to display.
 * @return The user's answer.
 */
```

**PHP (PHPDoc):** include full type annotations in `@param`, `@return`, and `@var` tags, as the WordPress Coding Standards require — even where the signature already declares the type.

```php
/**
 * Records a single battery benchmark sample and persists it.
 *
 * @param Sample $sample The captured benchmark sample.
 * @return int The stored sample's identifier.
 */
```

## File Naming

All source files (both JS/TS and PHP) must use **CamelCase** (e.g. `BatteryMonitor.php`, `BenchmarkRunner.ts`, `IRenderer.ts`, `SampleType.ts`). This applies to every file regardless of what it exports — classes, interfaces, types, constants, or utilities.

## Markup & Views

**Never write HTML or inline styles inside PHP.** No literal markup in `?> … <?php` template islands, no HTML strings assembled inline in a method, and no `style="…"` attributes or `<style>` blocks emitted from PHP.

- All markup lives in a **view**: a class implementing the `View` interface (`ErdemBircan\BatterySurfBench\Support\View`) that owns its HTML inside a heredoc and returns it from `render()`. Concrete views live in a `Views/` subfolder of their domain (e.g. `includes/Cockpit/Views/`).
- PHP that needs markup — a manager, a block `render.php` — prepares the dynamic, already-escaped values and hands them to a view; it never builds HTML itself.
- Styling belongs in a stylesheet (see **Styles**), never in inline `style` attributes or `<style>` tags printed from PHP.

## Styles

**Author all styles as SCSS — never hand-write `.css` files.** A hand-written `.css` file in the source tree is a regression: every stylesheet must have an SCSS source that the build compiles into its CSS artifact. Always enqueue the compiled artifact, never a CSS file edited by hand. Discover where sources live and where they compile to from the build configuration — don't assume a fixed directory layout, tool, or naming convention.

**Stylesheets are mirrored for right-to-left sites.** The build writes an rtlcss-flipped `-rtl.css` twin beside every stylesheet, and `Assets::enqueue()` tells WordPress to serve the twin in its place whenever `is_rtl()`. A rule tied to physical coordinates — a position JavaScript measures from the left edge, a `left` the store sets inline, artwork that is never mirrored — must be pinned so rtlcss leaves it alone: wrap it in `/*! rtl:begin:ignore */` … `/*! rtl:end:ignore */`, or put `/*! rtl:ignore */` before a single rule. The `!` is required, because the compressed build drops every other comment; `cssnano.config.js` keeps these and nothing else. A pinned piece whose children sit in a row also needs `dir="ltr"` in its markup, or the row itself still reverses.

## Single Light Theme — No Dark Mode

**This app ships exactly one theme, and it is light.** There is no theme toggle and no reachable dark mode in the product.

- **The dark tokens are dormant, not a feature.** `src/styles/theme/_theme.scss` carries a full `[data-theme='dark']` (Dusk Lineup) block, but nothing in the running app ever sets `data-theme='dark'`. It is kept **only** as documentation / a hedge in case the decision is ever revisited — it is unreachable ~99.99% of the time. **The presence of those tokens is not permission to support dark mode.**
- **Never add dark handling.** Do not write `@media (prefers-color-scheme: dark)` rules, `[data-theme='dark']` overrides for new UI, or any theme switcher — in production code **or** in design mockups. Author every surface light-only. Use the theme tokens normally (they resolve to the light values); just never introduce new dark variants.
- **If dark is ever genuinely wanted, it's a maintainer decision** — raise it explicitly. Don't infer it from the dormant tokens.

## Mock Big Design Decisions First

**For any significant style or design decision, build a standalone HTML mockup before touching production code.** New UI surfaces, redesigns, distinctive components, palette/typography directions, novel interactions — prototype them as self-contained `.html` files (inline CSS/JS, self-contained assets — data-URI images or system fonts, no external CDN or remote resources), iterate on the mockup with the maintainer, and only port the approved direction into the real SCSS/markup/Interactivity code. This keeps exploration off the build/test/lint cycle and avoids churning production files through rejected ideas.

- **Publish the mockup as a native cloud artifact**, not a file committed to the repo. Render it with the Artifact tool — a private, claude.ai-hosted page with a persistent URL — and keep its backing `.html` in the job/session tmp dir (never the repo, never `/tmp` directly). Iterate by republishing the **same file path** so the artifact URL stays stable across revisions. Because artifacts are CSP-locked, the mockup must be fully self-contained (inline CSS/JS, data-URI assets) or styling silently breaks.
- **Record the artifact URL in the index** at `docs/mockups/README.md` — a table of mock name → artifact URL → one-line description. That folder holds only this index now (no HTML files); it keeps every exploration discoverable and reviewable without living in the source tree.
- **Present the mockup for review** (share the artifact link and/or a screenshot) and get a direction approved before implementing. Offer the concrete tweak levers (size, colour, spacing, motion) rather than guessing.
- **Don't mock trivial tweaks.** A one-off colour/spacing change in an existing, settled component is just an edit — reserve mockups for decisions big enough that a wrong guess wastes real implementation work.

## Testing Philosophy

**Test behavior, not implementation.**

Tests verify that code works correctly for its consumers. Focus on **what** the code does, not **how** it does it internally.

### Core Rules

1. **Test through the public interface.** Never assert on private methods, internal state, or implementation details.
2. **Consumer-oriented.** When a component's consumer is another component, treat that consumer as the end user. Test what it sees and relies on.
3. **Implementation-proof.** If an implementation changes but behavior stays the same, tests MUST still pass.
4. **All code changes need tests.** New features, bug fixes, refactors.
5. **Never touch the real filesystem.** Tests must never read from or write to actual files or directories. Mock the filesystem boundary — the `$wp_filesystem` abstraction (via an in-memory double) and any file functions — and assert against that. A test that opens, stats, reads, or writes a real path is wrong, even for "just a fixture."

### Unit and End-to-End Coverage

"All code changes need tests" means **both** layers, where each applies:

- **Unit tests** — for logic and component behavior: PHP through PHPUnit, JS/TS through vitest. The default for stores, views, services and helpers. Run with the project's `test` scripts.
- **End-to-end tests** — Playwright specs under `tests/e2e/` (`*.spec.mts`), run via `pnpm test:e2e` against a real WordPress instance. Add or extend these whenever a change affects **rendered markup, a URL route, or a user-facing flow** (e.g. the cockpit's controls and the store directives the markup exposes, the dashboard/course routes). The e2e blueprint runs with `WP_DEBUG_DISPLAY`, so any PHP notice printed into the page fails the run.

Keep e2e **in sync with the markup it asserts on.** An e2e selector or store-binding assertion (a class like `.bsb-run`, a directive like `data-wp-on--click="actions.toggleRun"`) is a contract: when you rename a class, action, or directive, update every e2e that references it **in the same change**. A stale selector matches nothing and silently rots until it fails far from the change that broke it.

### What to Assert

- Return values from public methods
- Side effects visible to consumers (hooks registered, WP functions called with correct args)
- Exception/error behavior on invalid input
- Interface compliance (`assertInstanceOf`)
- Singleton identity guarantee (consumers depend on getting the same instance)

### What NOT to Assert

- Private/protected property values
- Internal data structures or storage format
- Which private helper methods were called
- How a value was computed (only that the result is correct)
- Static property names or internal variable names

### Examples

#### Good: Test behavior through the public interface

```php
// Tests what consumers see: get/has return correct values
public function test_get_returns_stored_value(): void {
    $registry = new Registry(['name' => 'pitch-vault']);
    $this->assertSame('pitch-vault', $registry->get('name'));
}

// Tests interface compliance (consumers depend on this contract)
public function test_implements_container_interface(): void {
    $registry = new Registry([]);
    $this->assertInstanceOf(ContainerInterface::class, $registry);
}

// Tests error behavior consumers will encounter
public function test_get_throws_not_found_exception_for_unknown_key(): void {
    $registry = new Registry([]);
    $this->expectException(NotFoundExceptionInterface::class);
    $registry->get('nonexistent');
}
```

#### Good: Test the guarantee, not the mechanism

```php
// Consumers depend on getting the same instance - test that
public function test_initialize_returns_same_instance(): void {
    $first  = PitchVault::initialize('/path/to/plugin.php');
    $second = PitchVault::initialize('/path/to/plugin.php');
    $this->assertSame($first, $second);
}
```

#### Bad: Testing implementation details

```php
// BAD: Asserts on internal property name
public function test_singleton_stores_in_static_property(): void {
    PitchVault::initialize('/path');
    $ref = new ReflectionClass(PitchVault::class);
    $prop = $ref->getProperty('instance'); // couples to property name
    $this->assertNotNull($prop->getValue());
}

// BAD: Tests internal array structure instead of public behavior
public function test_registry_internal_items_array(): void {
    $registry = new Registry(['key' => 'val']);
    $ref = new ReflectionClass($registry);
    $items = $ref->getProperty('items');
    $this->assertArrayHasKey('key', $items->getValue($registry));
}
```

#### Good: Test observable side effects

```php
// Tests that the WP hook was registered (consumer-visible behavior)
public function test_init_hooks_register_on_init(): void {
    $cpt = new TestablePostType('test_cpt', 'Test', 'prefix', 'manage_options');
    $cpt->init();
    $this->assertNotFalse(has_action('init', [$cpt, 'register']));
}

// Tests that WP receives the right arguments (the external contract)
public function test_register_meta_prefixes_field_keys(): void {
    Functions\expect('register_post_meta')
        ->once()
        ->with('test_cpt', 'prefix_field_a', \Mockery::type('array'));
    $cpt = new TestablePostType('test_cpt', 'Test', 'prefix', 'manage_options');
    $cpt->register_meta();
}
```

### Checklist Before Writing a Test

1. Am I testing a public method or observable side effect?
2. Would this test break if I refactored internals without changing behavior?
   - If yes, rewrite the test.
3. Does this test use Reflection to access private members?
   - Only acceptable in `tearDown()` for cleanup (e.g., resetting singletons). Never in assertions.
4. Am I asserting the **result** or the **mechanism**?
   - Assert the result.

### Tooling

Any test that touches WordPress must extend the project's base test case, which wires the WordPress function/hook mocking lifecycle (setup/teardown) so individual tests don't repeat it. Run tests through the project's defined test script rather than invoking a runner directly, so you inherit its configuration. Find the base test case, the mocking library, and the available test/coverage scripts from the test setup and `composer.json` rather than assuming their names.

## Don't Live with Broken Windows

When you notice a defect — a bug, a failing or skipped test, a lint violation, dead or wrong code, a misleading comment, a contract that no longer matches the code — **deal with it.** "It's pre-existing" or "not part of my change" is not a reason to leave it broken: a defect you saw and walked past is one you now own. One unrepaired broken window invites the next, and the codebase rots.

- **Fix it now**, in the same change, when the fix is small and in scope.
- **If it's genuinely too large or out of scope**, don't silently move on — surface it to the maintainer and track it (issue, backlog item, or a TODO with enough context to act on later). Board the window up; never just pass it.
- **Never normalize a broken state.** Don't skip/`@xfail` a failing test, suppress a warning, or rewrite an assertion to match wrong behavior just to reach green. That isn't a fix — it's a bigger broken window.

## Linting & PHPCS

**Never silence a PHPCS finding on your own judgement.** Do not reach for `// phpcs:ignore`/`// phpcs:disable` or a `phpcs.xml.dist` exclusion just to make an error or warning go away. A self-applied suppression hides a problem instead of fixing it.

- **Fix the cause.** Almost every finding has a real fix: read the request through `get_query_var()` instead of `$_GET`, read files through `WP_Filesystem` instead of `file_get_contents`, define test constants in `phpunit.xml` instead of in PHP, restructure output so it is escaped, and so on.
- **If you genuinely cannot get around a finding, stop and ask.** Surface the exact rule and code, explain why no code fix works, and let the maintainer decide. **Suppression is the maintainer's call, never the agent's.** The maintainer also chooses the form, and both are legitimate once approved:
  - a **line-scoped inline `// phpcs:ignore <rule> -- <reason>`** for a precise, genuinely-unavoidable single line (e.g. echoing a trusted pre-rendered document), which keeps the sniff guarding every other line in the file;
  - a **documented, narrowly-scoped exclusion in `phpcs.xml.dist`** for a whole category (e.g. test-infrastructure rules in `tests/`).
  Every approved suppression names the rule and carries a justification.

## Running Lints & Tests

**Never pipe a lint or test command through `tail` (or `head`), or otherwise truncate its output.** This applies to every lint, test, and type-check command in the project.

- **Findings print above the footer.** Linters and test runners typically print their error report *before* the trailing summary line (e.g. `Time: … Memory: …`). Truncating to the last few lines shows only that footer, so an entire report of failures is invisible and the run looks clean.
- **A pipe masks the exit code.** In `cmd | tail`, the shell reports `tail`'s status (always `0`), hiding a real non-zero failure.
- **Instead:** run the command with full output and confirm the genuine exit code, e.g. `composer lint; echo "EXIT=$?"`. Read the whole report, or `grep` for the error summary. Reserve truncation for genuinely verbose commands that clearly succeed at the end (installs, builds), and even then check the real status (e.g. `${PIPESTATUS[0]}`).

## CI — Wait for Every Check to Finish Green

CI runs after every push to a pull request and after every merge. Before treating any work as done — or moving on to anything that depends on it — **wait until all CI checks have finished and are green.**

- **The visible checks are not necessarily the whole set.** A check that passes can trigger further checks that are queued, not yet started, or not yet visible at the moment you look. Discover which checks the repository actually runs and wait for the complete set to settle — including any that appear only after earlier ones pass.
- **Never act on a partial or pending result.** Do not merge, report success, or walk away while any check is still running, queued, or yet to be triggered. "Green" means every check that will run has run and passed.
- **If any check ends red, stop and fix it before proceeding.** Never leave a branch — or the default branch — in a failing state.

### Squash-Merging — Always Supply Your Own Commit Message

When squash-merging a PR into `master`, **always provide an explicit commit subject and body** — never accept GitHub's auto-generated squash message.

- **Why this matters.** GitHub's default squash message concatenates the message of *every* squashed commit into the body. If any of those commits carries a CI directive such as `[skip ci]` (common on docs/mockup commits), it lands in the merge commit message, and GitHub then **skips every workflow for that push to `master`** — merge checks, e2e, the i18n `.pot` regeneration, all of it — silently. The merge looks done, but nothing was validated and generated artifacts go stale.
- **How.** Pass the message explicitly: `gh pr merge <n> --squash -t "[TYPE]: <description>" -b "<concise human summary>"` (or edit the squash message in the GitHub web UI before confirming). The subject follows the Conventional Commits format below; the body is a short hand-written summary, never the raw list of squashed commits.
- **Never** let `[skip ci]` (or any other skip directive) reach a commit that will be squashed into `master`.

## File Reads & Writes

**Never use raw PHP filesystem functions; always go through the WordPress filesystem API.** No `file_get_contents`/`file_put_contents`/`fopen`/`fwrite`/`unlink`/`mkdir`/etc. for reading or writing files — use the `WP_Filesystem` abstraction (request credentials for the target first, then `$wp_filesystem->exists()`/`get_contents()`/`put_contents()`). The lone exception is `require`/`include` of a bundled PHP file (e.g. a build manifest), which is code inclusion, not file I/O.

## Commit Conventions — Conventional Commits

### Commit Message Format

Use the following format for all commit messages:

```
[{TYPE}]: {description}
```

### Commit Types

- **FEAT**: A new feature for the user
- **FIX**: A bug fix
- **DOCS**: Documentation only changes
- **STYLE**: Changes that do not affect the meaning of the code (white-space, formatting, missing semi-colons, etc)
- **REFACTOR**: A code change that neither fixes a bug nor adds a feature
- **PERF**: A code change that improves performance
- **TEST**: Adding missing tests or correcting existing tests
- **CHORE**: Changes to the build process or auxiliary tools and libraries such as documentation generation

### Examples

```
[FEAT]: add user authentication system
[FIX]: resolve login redirect issue
[DOCS]: update API documentation
[STYLE]: fix code formatting
[REFACTOR]: restructure user service
[PERF]: improve database query performance
[TEST]: add unit tests for payment module
[CHORE]: update dependencies
```

### **IMPORTANT**
**DO NOT INCLUDE AI TOOL CREDITS OR CO-AUTHORSHIP ATTRIBUTION IN COMMIT MESSAGES**

### Guidelines

- Don't list extra changes or explanations in the commit message after the main description
- Use the imperative mood in the description ("add" not "added" or "adds")
- Don't capitalize the first letter of the description
- Capitalize the type (feat, fix, etc.)
- No period at the end of the description
- Keep the description concise (50 characters or less is ideal)
- After making a commit, explain to the user your reasoning behind choosing the commit type and description
