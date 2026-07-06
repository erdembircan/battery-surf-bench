/**
 * The discharge-simulation sub-tool: the dev-tools panel's second section,
 * additive alongside the battery-override tool rather than a rework of it. A
 * 1-second ticker evaluates the pure model ({@link ./DischargeSim}) against
 * the clock and writes the result into its own `sim.currentLevel` output
 * field — never into `state.devtools.battery`, the manual override's own
 * field. The two layers are combined into the single effective override by
 * the pure resolver {@link ./EffectiveBatteryOverride}, which every consumer
 * (display, sample recording, the plugged/target-drop stops, the panel's own
 * level row) reads instead of the manual layer directly. Because the sim
 * never touches the manual layer, stopping it (or letting it complete) simply
 * stops it winning — whatever the manual override held underneath (or
 * nothing, if it was never armed) is exactly what's left, with no separate
 * reset needed for the battery fields.
 *
 * Also exports {@link resetDischargeSim}, a plain function rather than a
 * `StorePart` action — the panel's cross-cutting Reset button ({@link
 * ./ResetStore}) composes it directly, so this sub-tool's own reset (stop the
 * ticker, restore the steppers to {@link ./DischargeSim}.DEFAULT_SIM) lives
 * here, next to the ticker it stops.
 */

import { getElement } from '@wordpress/interactivity';
import { type StorePart } from '../cockpit/StoreParts';
import { current } from './DevtoolsStore';
import { simulatedLevel, isSimComplete, DEFAULT_SIM } from './DischargeSim';

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
 * Writes the simulated level for the current instant into the sim's own
 * `currentLevel` output field — never the manual override's `battery` field
 * — stopping the ticker and reverting (`running` false, `currentLevel` null)
 * once the run's end is reached.
 */
const tick = (): void => {
	const { sim } = current();

	if ( ! sim.running || sim.startedAt === null ) {
		stopTicker();
		return;
	}

	const elapsed = Date.now() - sim.startedAt;
	sim.currentLevel = simulatedLevel( sim, elapsed );

	if ( isSimComplete( sim, elapsed ) ) {
		stopTicker();
		sim.running = false;
		sim.currentLevel = null;
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
 * Stops a running sim and restores its full state to {@link DEFAULT_SIM} —
 * `running`, `startedAt`, `currentLevel`, and the
 * `fromPercent`/`toPercent`/`minutes` steppers. Exported (rather than folded
 * into a `StorePart` action) so the panel's cross-cutting Reset button
 * ({@link ./ResetStore}) can call it directly without a second store member.
 * Does not touch `battery.level`/`charging` — clearing those back to "follow
 * the system" is the battery sub-tool's own reset ({@link
 * ./BatteryOverrideStore}.resetBatteryOverride), which the panel-wide reset
 * composes alongside this one; this sub-tool's own state never reached that
 * field in the first place.
 */
export const resetDischargeSim = (): void => {
	stopTicker();

	const { sim } = current();
	sim.running = false;
	sim.startedAt = null;
	sim.currentLevel = null;
	sim.fromPercent = DEFAULT_SIM.fromPercent;
	sim.toPercent = DEFAULT_SIM.toPercent;
	sim.minutes = DEFAULT_SIM.minutes;
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
		 * `disabled` binding enforces) or stops it. Starting seeds
		 * `currentLevel` at the configured start immediately, so the panel does
		 * not wait a full tick to show the run has begun — it never touches
		 * `battery.charging`/`battery.level`, the manual override's own fields.
		 * Stopping clears the ticker, flips `running` false, and clears
		 * `currentLevel` back to null: since the sim never wrote to the manual
		 * layer, there is nothing to revert there — whatever override (or lack
		 * of one) was underneath is simply what the cockpit sees again.
		 */
		devtoolsToggleSim(): void {
			const { sim } = current();

			if ( sim.running ) {
				stopTicker();
				sim.running = false;
				sim.currentLevel = null;
				return;
			}

			if ( sim.toPercent >= sim.fromPercent ) {
				return;
			}

			sim.startedAt = Date.now();
			sim.running = true;
			sim.currentLevel = simulatedLevel( sim, 0 );
			startTicker();
		},
	},
};
