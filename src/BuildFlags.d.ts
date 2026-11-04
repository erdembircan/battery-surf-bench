/**
 * Whether this build carries the dev-tools panel: `true` in a development build
 * (`pnpm run assets:development`, `pnpm start`), `false` in a production build
 * (`pnpm run assets:production`). `DevToolsFlagPlugin` replaces it with a
 * literal at build time, so a production build drops every branch it guards;
 * Vitest defines it as `true`, so the unit tests see the development build.
 */
declare const BSB_DEV_TOOLS: boolean;
