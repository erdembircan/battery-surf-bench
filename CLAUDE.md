# CLAUDE.md

## Prototype Repo

When the user refers to **"the prototype repo"** (or "the prototype"), they mean the GitHub repository [`erdembircan/battery-surf-bench_dep`](https://github.com/erdembircan/battery-surf-bench_dep) — a deprecated, archived vibe-coded prototype built to validate the idea before this repository existed. It is **not** maintained and should never be treated as the source of truth for the current architecture or contracts.

Its value is historical: it contains integration details and key insights about model behavior that were learned while prototyping. Consult it as background reference when those details are relevant, but always defer to this repository for anything authoritative.

## Knowledge Base

`docs/knowledge-base/` contains reference material used to inform the design and implementation of battery-surf-bench. Covers published battery-benchmark methodologies, real-user browsing behavior statistics, the battery drain-rate calculation and projection math, and the research-derived surfer behavior profile. This is background research — agents and contributors should consult it when making decisions about how the tool should behave.

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

## Testing Philosophy

**Test behavior, not implementation.**

Tests verify that code works correctly for its consumers. Focus on **what** the code does, not **how** it does it internally.

### Core Rules

1. **Test through the public interface.** Never assert on private methods, internal state, or implementation details.
2. **Consumer-oriented.** When a component's consumer is another component, treat that consumer as the end user. Test what it sees and relies on.
3. **Implementation-proof.** If an implementation changes but behavior stays the same, tests MUST still pass.
4. **All code changes need tests.** New features, bug fixes, refactors.

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

Tests run on **PHPUnit** with **Brain Monkey** for WordPress function/hook mocking. The base `ErdemBircan\BatterySurfBench\Tests\TestCase` wires Brain Monkey's `setUp`/`tearDown` into the lifecycle — extend it for any test that touches WordPress. Run the suite with `composer test` (coverage via `composer test:coverage`).

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
