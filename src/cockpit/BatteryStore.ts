/**
 * The battery slice of the cockpit store: the live battery readouts and the
 * Battery Status API wiring that feeds them and the drain-rate calculations.
 * Records samples into the run session while a run is live and enforces the
 * charger guard — a benchmark must drain the battery, so plugging in mid-run
 * ends the run.
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from './CockpitContext';
import { type StorePart } from './StoreParts';
import { instanceFor, now } from './RunInstance';
import { applyReadouts, stopRun } from './RunLifecycle';
import { BatteryMonitor, type BatteryReading } from './BatteryMonitor';
import { targetCap } from './TargetControl';
import { applyDevOverrides } from './DevOverrides';

/** The battery slice of the `bsb/cockpit` store. */
export const batteryStore: StorePart = {
	state: {
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
				// startup postcard's back to the warning. Leaves the readouts at
				// their em-dash idle state.
				context.batterySupported = false;
				return () => undefined;
			}

			const instance = instanceFor();

			const monitor = new BatteryMonitor( {
				getBattery: provider,
				onReading: ( raw ) => {
					const reading = applyDevOverrides( raw );
					instance.lastReading = reading;
					context.batteryLevel = Math.round( reading.level * 100 );
					context.batteryCharging = reading.charging;

					// Record the draining reading into the live run BEFORE any stop
					// check, so the reading that reaches the target (or a run's final
					// reading) is part of the session the summary freezes rather than
					// discarded by the stop that immediately follows it. Charging
					// readings are not recorded — plugging in ends the run instead of
					// logging a charging sample.
					if ( instance.session.active && ! reading.charging ) {
						instance.session.record(
							now(),
							reading.level,
							reading.charging
						);
						applyReadouts( context, instance.session );
					}

					// A benchmark must drain the battery: plugging in mid-run ends
					// the run rather than recording charging samples.
					if ( reading.charging && context.running ) {
						stopRun( context, instance, 'plugged' );
					}

					// Target-drop run: stop the moment the battery has fallen to
					// the chosen stop-at level — at the target (75 stops at 75),
					// not a step past it. The reading that reaches it is already
					// recorded above, so the summary reflects the final drop.
					if (
						context.running &&
						context.mode === 'targetDrop' &&
						context.batteryLevel !== null &&
						context.batteryLevel <= context.targetPercent
					) {
						stopRun( context, instance, 'targetDrop' );
					}

					// While idle the stop-at target follows the battery down — it
					// can't sit above the battery you have. During a run it stays
					// fixed, so the run has a stable target to reach rather than one
					// that chases the draining level.
					if ( ! context.running ) {
						const cap = targetCap( context.batteryLevel );
						if ( context.targetPercent > cap ) {
							context.targetPercent = cap;
						}
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
	},
};
