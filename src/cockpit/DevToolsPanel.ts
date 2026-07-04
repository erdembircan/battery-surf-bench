/**
 * The floating dev-tools panel — a dev-build-only floating box on the cockpit,
 * mounted only where `process.env.NODE_ENV !== 'production'` (see `view.ts`),
 * so none of this module's code reaches a production bundle. Vanilla DOM rather
 * than an Interactivity directive: the Interactivity API only hydrates
 * server-rendered markup, and this panel's markup cannot be server-rendered
 * since it must not exist in production at all.
 *
 * Its first tool is the "Bypass charging gate" toggle, which flips
 * {@link devOverrides}'s `bypassCharging` and immediately forces a fresh
 * battery reading through the monitor's `refresh()` (see {@link ./BatteryMonitor})
 * so the effect is visible at once rather than waiting on the next heartbeat
 * (or never, while idle, since idle readings are otherwise event-driven only).
 */

import { devOverrides, onDevReading } from './DevOverrides';
import { instanceFor } from './RunInstance';

const STORAGE_KEY = 'bsb-dev-tools';

/** The shape persisted to `localStorage` between page loads. */
interface PersistedState {
	collapsed: boolean;
	bypassCharging: boolean;
}

/**
 * Reads the persisted panel state, tolerating absent or corrupt storage.
 *
 * @return The persisted state, or defaults if none is stored or it is invalid.
 */
const readPersisted = (): PersistedState => {
	const defaults: PersistedState = { collapsed: true, bypassCharging: false };

	try {
		const raw = window.localStorage.getItem( STORAGE_KEY );
		if ( ! raw ) {
			return defaults;
		}

		const parsed = JSON.parse( raw ) as Partial< PersistedState >;

		return {
			collapsed:
				typeof parsed.collapsed === 'boolean'
					? parsed.collapsed
					: defaults.collapsed,
			bypassCharging:
				typeof parsed.bypassCharging === 'boolean'
					? parsed.bypassCharging
					: defaults.bypassCharging,
		};
	} catch {
		return defaults;
	}
};

/**
 * Persists the panel state, silently tolerating a storage failure (e.g.
 * private mode).
 *
 * @param state The state to persist.
 */
const persist = ( state: PersistedState ): void => {
	try {
		window.localStorage.setItem( STORAGE_KEY, JSON.stringify( state ) );
	} catch {
		// Storage unavailable; the panel still works for this page load.
	}
};

const PANEL_HTML = `
	<button class="bsb-devtools__chip" type="button" aria-label="Open dev tools">
		<span class="bsb-devtools__chip-dot"></span>DEV
	</button>
	<div class="bsb-devtools__card">
		<div class="bsb-devtools__head">
			<span class="bsb-devtools__title">Dev tools</span>
			<button class="bsb-devtools__collapse" type="button" aria-label="Collapse dev tools">&#x2715;</button>
		</div>
		<div class="bsb-devtools__row">
			<div>
				<p class="bsb-devtools__label">Bypass charging gate</p>
				<p class="bsb-devtools__help">Run while plugged in &mdash; readings are not a real benchmark.</p>
			</div>
			<label class="bsb-devtools__switch">
				<input type="checkbox" class="bsb-devtools__bypass" />
				<span class="bsb-devtools__switch-track"></span>
				<span class="bsb-devtools__switch-thumb"></span>
			</label>
		</div>
		<p class="bsb-devtools__actual">Actually: <strong class="bsb-devtools__actual-state">on battery</strong></p>
	</div>
`;

/**
 * Builds the floating dev-tools panel and appends it to the given host,
 * wiring the collapse/expand toggle, the bypass switch, and the persisted
 * state restore. Never called in a production build.
 *
 * @param host The element the panel is appended to (the cockpit wrapper).
 */
export const mountDevToolsPanel = ( host: Element ): void => {
	const panel = document.createElement( 'div' );
	panel.className = 'bsb-devtools';
	panel.innerHTML = PANEL_HTML;
	host.appendChild( panel );

	const chip = panel.querySelector< HTMLButtonElement >(
		'.bsb-devtools__chip'
	)!;
	const collapse = panel.querySelector< HTMLButtonElement >(
		'.bsb-devtools__collapse'
	)!;
	const bypass = panel.querySelector< HTMLInputElement >(
		'.bsb-devtools__bypass'
	)!;
	const actual = panel.querySelector< HTMLElement >(
		'.bsb-devtools__actual'
	)!;
	const actualState = panel.querySelector< HTMLElement >(
		'.bsb-devtools__actual-state'
	)!;

	const setCollapsed = ( collapsed: boolean ): void => {
		panel.dataset.collapsed = String( collapsed );
	};

	const renderBypass = (): void => {
		const active = devOverrides.bypassCharging;
		chip.dataset.bypass = String( active );
		actual.dataset.visible = String( active );
	};

	const renderActual = (): void => {
		actualState.textContent = devOverrides.actualCharging
			? 'plugged in'
			: 'on battery';
	};

	const persisted = readPersisted();
	setCollapsed( persisted.collapsed );
	devOverrides.bypassCharging = persisted.bypassCharging;
	bypass.checked = persisted.bypassCharging;
	renderBypass();
	renderActual();
	if ( persisted.bypassCharging ) {
		instanceFor().monitor?.refresh();
	}

	chip.addEventListener( 'click', () => {
		setCollapsed( false );
		persist( {
			collapsed: false,
			bypassCharging: devOverrides.bypassCharging,
		} );
	} );

	collapse.addEventListener( 'click', () => {
		setCollapsed( true );
		persist( {
			collapsed: true,
			bypassCharging: devOverrides.bypassCharging,
		} );
	} );

	bypass.addEventListener( 'change', () => {
		devOverrides.bypassCharging = bypass.checked;
		renderBypass();
		persist( {
			collapsed: panel.dataset.collapsed === 'true',
			bypassCharging: bypass.checked,
		} );
		instanceFor().monitor?.refresh();
	} );

	onDevReading( renderActual );
};
