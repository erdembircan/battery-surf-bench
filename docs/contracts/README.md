# Architectural contracts

Charts in this folder are **contracts**, not implementation details. They define the
authoritative picture of the application's architecture and the interactions between its
modules — treat them with the same weight as API contracts. They describe what the system
*is*, not how it happens to be built right now.

Each chart shows public APIs, relationships (association, dependency, composition,
aggregation), and hierarchy (inheritance, interface implementation); abstractions are
visually distinguished. Private methods and internal helpers are never shown. Any change
that affects architecture, module interactions, or data flow must update the relevant chart
in the same commit or PR — a chart that does not match the code is actively misleading. See
`CLAUDE.md` for the full content rules.

- [php-class-interactions.md](php-class-interactions.md) — class interactions across the plugin's PHP classes: the bootstrap, the PSR-11 container, and its not-found exception.
