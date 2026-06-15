# CLAUDE.md

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

Classes and functions must be documented — JSDoc for JS/TS code, PHPDoc for PHP code. Do **not** add doc comments to types or interfaces — the language makes them self-explanatory. Where the language already declares the type (TypeScript annotations, PHP type declarations), omit redundant `@param {type}` / `@param type` and `@returns` / `@return` type annotations. Descriptions only.

JSDoc (TypeScript):

```ts
/**
 * Renders a question to the terminal using the Clack prompt library.
 *
 * @param question - The question to display.
 * @returns The user's answer.
 */
```

PHPDoc:

```php
/**
 * Records a single battery benchmark sample and persists it.
 *
 * @param $sample The captured benchmark sample.
 * @return The stored sample's identifier.
 */
```

## File Naming

All source files (both JS/TS and PHP) must use **CamelCase** (e.g. `BatteryMonitor.php`, `BenchmarkRunner.ts`, `IRenderer.ts`, `SampleType.ts`). This applies to every file regardless of what it exports — classes, interfaces, types, constants, or utilities.

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
