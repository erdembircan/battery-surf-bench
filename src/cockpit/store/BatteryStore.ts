/**
 * The battery slice of the cockpit store: the live battery readouts and the
 * Battery Status API wiring that feeds them and the drain-rate calculations.
 * Records samples into the run session while a run is live and enforces the
 * charger guard — a benchmark must drain the battery, so plugging in mid-run
 * ends the run.
 *
 * The dev-tools battery-override tool hooks in here rather than faking the
 * Battery Status API itself: every reading — real or forced — is resolved
 * through {@link resolveReading} before {@link applyReading} acts on it, so
 * display, sample recording and the stop conditions all see one truth. A
 * starting run's opening sample is resolved the same way, through
 * {@link seedRunSample}, never taken from the raw cached reading. With no
 * dev-tools module loaded `state.devtools` is undefined and the resolver is a
 * passthrough, so production behavior is unchanged.
 */

import { getContext, store } from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/store/StoreParts';
import { instanceFor, now, type InstanceState } from '@/cockpit/RunInstance';
import { applyReadouts, stopRun } from '@/cockpit/RunLifecycle';
import { BatteryMonitor, type BatteryReading } from '@/cockpit/BatteryMonitor';
import { targetCap } from '@/cockpit/TargetControl';
import {
	resolveReading,
	type BatteryOverrideState,
} from '@/cockpit/BatteryOverride';
import { effectiveBatteryOverride } from '@/devtools/EffectiveBatteryOverride';

/** The slice of the merged `battery-surf-bench/cockpit` state the override seam reads and writes. */
interface SharedBatteryState {
	devtools?: {
		battery?: BatteryOverrideState;
		sim?: { running: boolean; currentLevel: number | null };
	};
	/**
	 * The raw system battery percentage from the most recent real reading —
	 * never the dev-tools-overridden one — or null where no real reading
	 * exists yet (or ever will: no Battery Status API and nothing
	 * synthesized). Published here (rather than kept only on the reactive
	 * context) so the dev-tools panel, which has no cockpit context, can show
	 * the level row's "System" state as the actual live reading rather than a
	 * fixed placeholder.
	 */
	batterySystemPercent: number | null;
}

/** The merged store shape {@link currentOverride}/{@link publishSystemPercent} re-fetch by namespace. */
interface SharedBatteryStore {
	state: SharedBatteryState;
}

/**
 * Reads the dev-tools battery override off the shared cockpit state — the
 * single effective value resolved from the manual override layer and a
 * running discharge sim (see {@link ../../devtools/EffectiveBatteryOverride}).
 * Re-fetches the store by namespace (rather than closing over a reference
 * captured at import time) because the dev-tools module — if present at all
 * — joins the store from a separate script module, after this one has
 * already registered its slice.
 *
 * @return The effective override, or undefined where dev tools have not joined the store.
 */
const currentOverride = (): BatteryOverrideState | undefined => {
	if ( ! BSB_DEV_TOOLS ) {
		return undefined;
	}

	const { state } = store< SharedBatteryStore >(
		'battery-surf-bench/cockpit'
	);
	const { devtools } = state;

	if ( ! devtools?.battery ) {
		return undefined;
	}

	return effectiveBatteryOverride( {
		battery: devtools.battery,
		sim: devtools.sim,
	} );
};

/**
 * Publishes the raw system battery percentage from a real reading onto the
 * shared state, so it survives independent of whatever the dev-tools override
 * currently substitutes for display.
 *
 * @param percent The raw system level as a 0–100 percentage.
 */
const publishSystemPercent = ( percent: number ): void => {
	const { state } = store< SharedBatteryStore >(
		'battery-surf-bench/cockpit'
	);

	state.batterySystemPercent = percent;
};

/**
 * Records a draining reading into the live run and refreshes the derived
 * readouts. The one home of the rule that a run only ever logs draining
 * samples, shared by every reading the cockpit applies ({@link applyReading})
 * and by a starting run's opening sample ({@link seedRunSample}). A no-op while
 * no run is live, or for a charging reading: plugging in ends a run rather than
 * logging a charging sample.
 *
 * @param context  The reactive cockpit context to mirror the readouts onto.
 * @param instance The per-instance run state to record into.
 * @param reading  The resolved reading to record.
 */
const recordDraining = (
	context: CockpitContext,
	instance: InstanceState,
	reading: BatteryReading
): void => {
	if ( ! instance.session.active || reading.charging ) {
		return;
	}

	instance.session.record( now(), reading.level, reading.charging );
	applyReadouts( context, instance.session );
};

/**
 * Applies a resolved battery reading to the cockpit: syncs the display
 * context, records a draining sample into the live run, enforces the charger
 * guard (plugging in mid-run stops it), stops a target-drop run the instant it
 * reaches its mark, and — while idle — keeps the target slider capped to the
 * battery on hand. The single path every reading (real or dev-tools-forced)
 * drives, so every consumer of the battery sees the same truth.
 *
 * @param context  The reactive cockpit context to update.
 * @param instance The per-instance run state to record into and act on.
 * @param reading  The resolved reading to apply.
 */
export const applyReading = (
	context: CockpitContext,
	instance: InstanceState,
	reading: BatteryReading
): void => {
	context.batteryLevel = Math.round( reading.level * 100 );
	context.batteryCharging = reading.charging;

	// Record the draining reading into the live run BEFORE any stop check, so
	// the reading that reaches the target (or a run's final reading) is part of
	// the session the summary freezes rather than discarded by the stop that
	// immediately follows it. Charging readings are not recorded — plugging in
	// ends the run instead of logging a charging sample.
	recordDraining( context, instance, reading );

	// A benchmark must drain the battery: plugging in mid-run ends the run
	// rather than recording charging samples.
	if ( reading.charging && context.running ) {
		stopRun( context, instance, 'plugged' );
	}

	// Target-drop run: stop the moment the battery has fallen to the chosen
	// stop-at level — at the target (75 stops at 75), not a step past it. The
	// reading that reaches it is already recorded above, so the summary
	// reflects the final drop.
	if (
		context.running &&
		context.mode === 'targetDrop' &&
		context.batteryLevel !== null &&
		context.batteryLevel <= context.targetPercent
	) {
		stopRun( context, instance, 'targetDrop' );
	}

	// While idle the stop-at target follows the battery down — it can't sit
	// above the battery you have. During a run it stays fixed, so the run has a
	// stable target to reach rather than one that chases the draining level.
	if ( ! context.running ) {
		const cap = targetCap( context.batteryLevel );
		if ( context.targetPercent > cap ) {
			context.targetPercent = cap;
		}
	}
};

/**
 * Records a freshly started run's opening sample: the cached raw reading
 * resolved through the effective dev-tools override, the same resolution every
 * later reading gets before {@link applyReading} acts on it. Never the raw
 * cached reading itself, which would open the run on the host's real battery
 * while the readouts show the override (and, with Discharging forced on a
 * charging host, on a charging sample). The sample goes through the same
 * draining-only rule as every other one, but none of {@link applyReading}'s
 * stop checks run here: starting a run never ends it on the spot. With no
 * dev-tools module loaded the resolver is a passthrough, so production opens
 * every run on the latest real reading. A no-op while no reading exists yet;
 * the first one to arrive is recorded as usual.
 *
 * @param context  The reactive cockpit context to mirror the readouts onto.
 * @param instance The per-instance run state whose freshly started session receives the sample.
 */
export const seedRunSample = (
	context: CockpitContext,
	instance: InstanceState
): void => {
	const reading = resolveReading( instance.lastReading, currentOverride() );

	if ( reading ) {
		recordDraining( context, instance, reading );
	}
};

/** The battery slice of the `battery-surf-bench/cockpit` store. */
export const batteryStore: StorePart = {
	state: {
		/**
		 * The raw system battery percentage from the most recent real reading,
		 * or null before any reading has arrived (or ever will, on a platform
		 * with no Battery Status API). See {@link SharedBatteryState} — read
		 * by the dev-tools panel, never written by it.
		 */
		batterySystemPercent: null as number | null,

		/** Current battery level as a readout number, or an em dash if unknown. */
		get batteryDisplay(): string {
			const { batteryLevel } = getContext< CockpitContext >();

			return batteryLevel === null ? '—' : String( batteryLevel );
		},

		/** Battery readout colour: green when full grading to red when low. */
		get batteryColor(): string {
			const { batteryLevel } = getContext< CockpitContext >();

			if ( batteryLevel === null ) {
				return 'var(--text-soft)';
			}

			const hue = Math.round( ( batteryLevel / 100 ) * 120 );

			return `hsl(${ hue }, 70%, 45%)`;
		},

		/** Whether the device is charging — drives the charging bolt. */
		get isCharging(): boolean {
			return getContext< CockpitContext >().batteryCharging;
		},

		/**
		 * Whether the Battery Status API is missing, so no run can be benchmarked
		 * (there is no battery data to measure). Locks the cockpit: the deck stays
		 * tucked away, the startup postcard's back turns to the unsupported
		 * warning, and the run control refuses to start.
		 */
		get isBatteryUnsupported(): boolean {
			return ! getContext< CockpitContext >().batterySupported;
		},
	},
	callbacks: {
		/**
		 * Feeds the battery readouts and the drain-rate calculations from the
		 * Battery Status API. On every reading — whether from a change event or the
		 * backup heartbeat — it syncs the level and charging state, caps the target
		 * to the battery on hand, and, while a run is live, records the sample and
		 * refreshes the derived rates and projection. Plugging in mid-run stops the
		 * run (a benchmark must drain the battery). A no-op where the API is absent,
		 * leaving the readouts at their em-dash idle state. Returns a cleanup that
		 * detaches the listeners and stops the heartbeat.
		 *
		 * @return A cleanup that stops the monitor.
		 */
		initBattery(): () => void {
			const provider = (
				navigator as Navigator & {
					getBattery?: () => Promise<
						BatteryReading & {
							addEventListener: (
								t: string,
								l: () => void
							) => void;
							removeEventListener: (
								t: string,
								l: () => void
							) => void;
						}
					>;
				}
			 ).getBattery?.bind( navigator );

			const context = getContext< CockpitContext >();

			if ( ! provider ) {
				// No Battery Status API (Safari, Firefox): flag the cockpit
				// unsupported so the view locks every control and turns the
				// startup postcard's back to the warning — unless the dev-tools
				// battery override is armed with both fields set, in which case a
				// full reading is synthesized so the tool still works here.
				// `syncBatteryOverride` re-applies whenever the override changes,
				// so arming it unlocks the cockpit with no reload.
				context.batterySupported = false;

				const instance = instanceFor();
				instance.lastReading = null;

				const resolved = resolveReading( null, currentOverride() );
				if ( resolved ) {
					context.batterySupported = true;
					applyReading( context, instance, resolved );
				}

				return () => undefined;
			}

			const instance = instanceFor();

			const monitor = new BatteryMonitor( {
				getBattery: provider,
				onReading: ( reading ) => {
					instance.lastReading = reading;
					publishSystemPercent( Math.round( reading.level * 100 ) );

					const resolved = resolveReading(
						reading,
						currentOverride()
					);
					if ( resolved ) {
						applyReading( context, instance, resolved );
					}
				},
			} );

			instance.monitor = monitor;
			// Acquire passively (live readout + charger guard); the heartbeat poll
			// is driven by the run-polling watch, which reacts to `running`.
			monitor.start();

			return () => {
				monitor.stop();
				instance.monitor = null;
			};
		},

		/**
		 * Re-applies the cached raw reading whenever the dev-tools battery
		 * override changes, so flipping the toggle takes effect immediately —
		 * including triggering the plugged auto-stop mid-run or unlocking an
		 * unsupported browser — instead of waiting for the next real battery
		 * event. Bound via `data-wp-watch--devtools-battery`; reading
		 * `state.devtools?.battery` (through {@link currentOverride}) is what
		 * makes this re-run reactively. In production, with no dev-tools module
		 * loaded, `state.devtools` is undefined and this reads it once and never
		 * does anything again.
		 *
		 * On a platform with no Battery Status API, disarming a previously-armed
		 * synthetic override resolves to no reading at all — the mirror of the
		 * arm path: the cockpit is returned to the unsupported idle state
		 * (`batterySupported` false, readouts at their em-dash idle values, as
		 * `initBattery`'s no-provider branch leaves them). A run started under
		 * the synthetic override is first stopped with the `stopped` reason —
		 * the disarm is a manual dev action, and stopping through the normal
		 * teardown preserves the run's summary instead of leaving a live run
		 * with no battery source. The revert is gated on the API actually being
		 * absent (the same probe `initBattery` uses), never on a merely
		 * not-yet-arrived first reading, so a supported browser is never
		 * wrongly locked while its first reading is still in flight.
		 */
		syncBatteryOverride(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();
			const resolved = resolveReading(
				instance.lastReading,
				currentOverride()
			);

			if ( resolved ) {
				if (
					! context.batterySupported &&
					instance.lastReading === null
				) {
					context.batterySupported = true;
				}
				applyReading( context, instance, resolved );
				return;
			}

			const platformHasBattery =
				typeof ( navigator as Navigator & { getBattery?: unknown } )
					.getBattery === 'function';

			if ( platformHasBattery || ! context.batterySupported ) {
				return;
			}

			// Synthetic override disarmed on a no-battery platform: wind up any
			// run it was powering, then restore the unsupported idle state so
			// the forced readouts do not linger as if they were real.
			if ( context.running ) {
				stopRun( context, instance, 'stopped' );
			}

			context.batterySupported = false;
			context.batteryLevel = null;
			context.batteryCharging = false;
		},
	},
};
