/**
 * The discharge-simulation sub-tool: the dev-tools panel's second section,
 * additive alongside the battery-override tool rather than a rework of it.
 * It is purely a *driver* of the existing battery-override seam — a 1-second
 * ticker evaluates the pure model ({@link ./DischargeSim}) against the clock
 * and writes the result into `state.devtools.battery.level` (forcing
 * `charging` to discharging on start), so display, sample recording, the
 * plugged/target-drop stops and the panel's own level row all react exactly
 * as they would to a real draining battery. No new interception mechanism,
 * and no new "armed" logic — a running sim diverges `battery.level`, which
 * `devtoolsIsArmed` (in {@link ./BatteryOverrideStore}) already reads.
 */

import { getElement } from '@wordpress/interactivity';
import { type StorePart } from '../cockpit/StoreParts';
import { current } from './DevtoolsStore';
import { simulatedLevel, isSimComplete } from './DischargeSim';

/**
 * Clamps a value to a closed range.
 *
 * @param value The value to clamp.
 * @param min   The range's lower bound.
 * @param max   The range's upper bound.
 */
const clamp = ( value: number, min: number, max: number ): number =>
	Math.min( max, Math.max( min, value ) );

/** The interval id driving the running sim, or undefined while stopped. */
let tickerId: ReturnType< typeof setInterval > | undefined;

/** How often the ticker re-evaluates the simulated level. */
const TICK_MS = 1000;

/**
 * Writes the simulated level (and forces discharging) for the current
 * instant, stopping the ticker and freezing `running` false once the run's
 * end is reached.
 */
const tick = (): void => {
	const state = current();
	const { sim } = state;

	if ( ! sim.running || sim.startedAt === null ) {
		stopTicker();
		return;
	}

	const elapsed = Date.now() - sim.startedAt;
	state.battery.level = simulatedLevel( sim, elapsed );
	state.battery.charging = false;

	if ( isSimComplete( sim, elapsed ) ) {
		stopTicker();
		sim.running = false;
	}
};

/** Starts the ticker, idempotently. */
const startTicker = (): void => {
	if ( tickerId !== undefined ) {
		return;
	}

	tickerId = setInterval( tick, TICK_MS );
};

/** Stops the ticker, idempotently. */
const stopTicker = (): void => {
	if ( tickerId !== undefined ) {
		clearInterval( tickerId );
		tickerId = undefined;
	}
};

/**
 * Resumes a sim restored as `running` from a previous session. The sim's
 * truth is the persisted `startedAt` timestamp, not the ticker (which never
 * survives a reload) — so this recomputes exactly where the run should be:
 * past its end, it freezes the end level and stops; still mid-flight, it
 * applies the current instant immediately and restarts the ticker. Called
 * once, right after {@link ./DevtoolsStore}.hydrateDevtools restores the raw
 * fields.
 */
export const resumeDischargeSim = (): void => {
	const state = current();
	const { sim } = state;

	if ( ! sim.running || sim.startedAt === null ) {
		return;
	}

	const elapsed = Date.now() - sim.startedAt;
	state.battery.level = simulatedLevel( sim, elapsed );
	state.battery.charging = false;

	if ( isSimComplete( sim, elapsed ) ) {
		sim.running = false;
		return;
	}

	startTicker();
};

/** The discharge-simulation section of the dev-tools panel, joining `bsb/cockpit`. */
export const dischargeSimStore: StorePart = {
	state: {
		/** The configured start percentage, as display text. */
		get devtoolsSimFromDisplay(): string {
			return String( current().sim.fromPercent );
		},

		/** The configured end percentage, as display text. */
		get devtoolsSimToDisplay(): string {
			return String( current().sim.toPercent );
		},

		/** The configured duration in minutes, as display text. */
		get devtoolsSimMinutesDisplay(): string {
			return String( current().sim.minutes );
		},

		/** Whether the ticker is currently driving the level override. */
		get devtoolsIsSimRunning(): boolean {
			return current().sim.running;
		},

		/**
		 * Whether the Start/Stop button should be disabled: only while not
		 * running and the configured end is not below the start — Stop must
		 * always stay available once a run is live.
		 */
		get devtoolsIsSimStartBlocked(): boolean {
			const { running, fromPercent, toPercent } = current().sim;

			return ! running && toPercent >= fromPercent;
		},
	},
	actions: {
		/**
		 * Steps one of the sim's three config fields from the triggering
		 * control's `data-devtools-sim-field` (`from` | `to` | `minutes`) and
		 * `data-step` (the signed step amount), clamped to that field's range.
		 * A no-op while running — the steppers are also disabled then, this
		 * guards a forced or tampered call the same way.
		 */
		devtoolsStepSim(): void {
			const { ref } = getElement();
			const el = ref as HTMLElement | null;
			const field = el?.dataset.devtoolsSimField;
			const step = Number( el?.dataset.step );

			if ( ! Number.isFinite( step ) ) {
				return;
			}

			const sim = current().sim;

			if ( sim.running ) {
				return;
			}

			if ( field === 'from' ) {
				sim.fromPercent = clamp( sim.fromPercent + step, 0, 100 );
			} else if ( field === 'to' ) {
				sim.toPercent = clamp( sim.toPercent + step, 0, 100 );
			} else if ( field === 'minutes' ) {
				sim.minutes = clamp( sim.minutes + step, 5, 60 );
			}
		},

		/**
		 * Starts the sim (guarded by the same `to < from` rule the button's
		 * `disabled` binding enforces) or stops it. Starting forces discharging
		 * and seeds the level at the configured start immediately, so the
		 * panel does not wait a full tick to show the run has begun. Stopping
		 * only clears the ticker and flips `running` false — the overrides
		 * stay frozen exactly where they were; the System buttons already exist
		 * to clear them.
		 */
		devtoolsToggleSim(): void {
			const state = current();
			const { sim } = state;

			if ( sim.running ) {
				stopTicker();
				sim.running = false;
				return;
			}

			if ( sim.toPercent >= sim.fromPercent ) {
				return;
			}

			sim.startedAt = Date.now();
			sim.running = true;
			state.battery.charging = false;
			state.battery.level = simulatedLevel( sim, 0 );
			startTicker();
		},
	},
};
