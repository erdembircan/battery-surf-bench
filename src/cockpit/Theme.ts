/**
 * Theme resolution and persistence for the cockpit deck.
 *
 * The deck offers two palettes — Coastal Daybreak (light) and Dusk Lineup
 * (dark) — chosen by a preference that can also follow the operating system.
 * This module owns the preference vocabulary, how a preference resolves to an
 * applied theme, and how the choice is remembered across visits, so the store
 * only has to wire these to context and the toggle control.
 */

/** The deck's resolved colour theme — Coastal Daybreak or Dusk Lineup. */
export type ThemeName = 'light' | 'dark';

/** The visitor's theme preference: a fixed theme, or follow the OS. */
export type ThemePref = 'light' | 'dark' | 'system';

/** localStorage key the theme preference is remembered under across visits. */
export const THEME_KEY = 'bsb-cockpit-theme';

/** The order the theme control cycles through on each press. */
export const THEME_ORDER: ThemePref[] = [ 'system', 'light', 'dark' ];

/** Whether the operating system currently prefers a dark colour scheme. */
export const osPrefersDark = (): boolean =>
	typeof window.matchMedia === 'function' &&
	window.matchMedia( '(prefers-color-scheme: dark)' ).matches;

/**
 * Resolves a preference to the theme actually applied: a fixed choice as-is, or
 * the operating system's current scheme when following the system.
 * @param pref
 */
export const resolveTheme = ( pref: ThemePref ): ThemeName => {
	if ( pref !== 'system' ) {
		return pref;
	}

	return osPrefersDark() ? 'dark' : 'light';
};

/**
 * The next preference in the cycle after the given one (system → light → dark →
 * system).
 * @param pref
 */
export const nextThemePref = ( pref: ThemePref ): ThemePref =>
	THEME_ORDER[ ( THEME_ORDER.indexOf( pref ) + 1 ) % THEME_ORDER.length ]!;

/**
 * The remembered preference, or `system` when nothing is stored or storage is
 * unavailable (private mode).
 */
export const readStoredPref = (): ThemePref => {
	try {
		const stored = window.localStorage.getItem( THEME_KEY );
		if ( stored === 'light' || stored === 'dark' || stored === 'system' ) {
			return stored;
		}
	} catch {
		// Storage unavailable; fall back to following the system.
	}

	return 'system';
};

/**
 * Remembers a preference across visits, silently tolerating unavailable storage
 * (the choice still applies for the current session).
 * @param pref
 */
export const writeStoredPref = ( pref: ThemePref ): void => {
	try {
		window.localStorage.setItem( THEME_KEY, pref );
	} catch {
		// Storage unavailable (private mode); the choice still applies for this
		// session.
	}
};
