/**
 * Ambient declarations for stylesheet side-effect imports.
 *
 * The build extracts CSS imported from a bundle entry; TypeScript only needs to
 * know these specifiers resolve to a module with no typed exports.
 */

declare module '*.css';
declare module '*.scss';
