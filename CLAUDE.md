# CLAUDE.md

## Isolate Before Reading

Sync the default branch and isolate into a fresh worktree as the first action of any task — before reading, searching, or inspecting a single repository file. Otherwise reads may come from a stale ref while other sessions merge, and no operation can trust what it read.

## Announce Completion Out Loud

The maintainer is frequently away from the keyboard or tapped out while work runs. Whenever you finish a unit of work — a task, a subtask, a fix, a commit, a pushed PR, anything you'd report as done — **announce it aloud** with the macOS `say` command, in addition to writing the result as text.

- Keep the spoken line short and specific: what got done, and whether checks/CI are green (e.g. `say "Timer auto-stop fixed and pushed, all checks green"`). Don't read out long output.
- Say it at the actual completion point, not before verification finishes — speaking "done" while tests are still running is misleading.
- This is about finishing work; routine progress chatter mid-task doesn't need narration.

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

`docs/plans/` holds the implementation plans for larger features. **Whenever a task, prompt, or discussion mentions a plan** — "the plan", "the dev-tools plan", "implement the plan" — check `docs/plans/` first and read the matching plan document in full before doing anything else. It is the authoritative design for that work: don't ask where the plan is, and don't re-derive or re-litigate decisions the plan already settles.

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

## JSDoc & PHPDoc

Classes and functions must be documented — JSDoc for JS/TS code, PHPDoc for PHP code. Do **not** add doc comments to types or interfaces — the language makes them self-explanatory.

**TypeScript (JSDoc):** the TypeScript annotation already declares the type, so omit redundant `@param {type}` / `@returns {type}` annotations — descriptions only.

```ts
/**
 * Renders a question to the terminal using the Clack prompt library.
 *
 * @param question - The question to display.
 * @returns The user's answer.
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

## Mock Big Design Decisions First

**For any significant style or design decision, build a standalone HTML mockup before touching production code.** New UI surfaces, redesigns, distinctive components, palette/typography directions, novel interactions — prototype them as self-contained `.html` files (inline CSS/JS, web fonts via CDN, openable directly in a browser, no build step), iterate on the mockup with the maintainer, and only port the approved direction into the real SCSS/markup/Interactivity code. This keeps exploration off the build/test/lint cycle and avoids churning production files through rejected ideas.

- **Store the mockups in the repo** under `docs/mockups/` (with a short entry in its `README.md`) so the explorations are preserved, reviewable, and easy to revisit — not left in a scratch/temp directory. They are experiments, not production code, and may be deleted once a design is settled.
- **Present the mockup for review** (screenshot and/or open it) and get a direction approved before implementing. Offer the concrete tweak levers (size, colour, spacing, motion) rather than guessing.
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

## Workflows — Run Them Locally, Then Do What They Do

**GitHub Actions is disabled.** The workflow definitions are parked under `.github_bak/` (renamed from `.github/` so Actions never triggers). They are not dead — they remain the **authoritative definition of what must pass and what side effects must happen** for each git operation. Nothing runs them for you anymore, so **you replay them locally and carry out the operations they define.**

`.github_bak/workflows/` is the single source of truth. **Read the relevant workflow file each time** and do exactly what it does — do not rely on a description here, and never restate its jobs, commands, or steps in this document (a copy here is a second source of truth that silently rots when the workflow changes).

The mandate, before any work counts as done:

- **Committing to a PR branch** → replay the PR-triggered workflow. Run each job's steps locally; every one green before you push. Then commit (Conventional Commits format), push, and **open the PR yourself** for me to review — don't stop to ask (see the auto-commit-and-PR convention).
- **Merging / pushing to `master`** → replay the push-to-`master` workflow. Run its jobs locally, **and** reproduce by hand every side effect it performs automatically on CI — anything it commits back to the repo (e.g. a regenerated artifact) you must generate and commit yourself, with the same conditions the workflow applies. Master must never be left in a state where a workflow step would have failed or a generated artifact is stale.

A red step is a stop-and-fix, exactly as a red CI check was. Never report success on a partial or skipped replay.

Each job declares its own setup. If a job needs a tool that isn't installed locally, obtain it the way the workflow's setup steps do, or via the tool's official container image.

In particular, **WP-CLI (`wp`) is not installed locally and won't be — run every `wp` operation through a Docker container** (its official image), not a local binary. That's the standing decision; the actual `wp` subcommand and flags are still derived from the workflow and the project script it runs, never copied here.

### Squash-Merging — Always Supply Your Own Commit Message

When squash-merging a PR into `master`, **always provide an explicit commit subject and body** — never accept GitHub's auto-generated squash message. Pass it explicitly: `gh pr merge <n> --squash -t "[TYPE]: <description>" -b "<concise human summary>"` (or edit the squash message in the web UI before confirming). The subject follows the Conventional Commits format below; the body is a short hand-written summary, never the raw concatenated list of squashed commits. After the merge, replay the merge-checks workflow locally as described above.

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
