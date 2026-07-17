/**
 * The Surf sub-tool: the dev-tools panel's third section, joining
 * `bsb/cockpit` from a separate script module like every other sub-tool (see
 * {@link ./BatteryOverrideStore}'s doc comment for the namespacing rule).
 * Arms/disarms the "Sterile" run override (which `../cockpit/RunStore` reads
 * defensively at run start) and, once a sterile run is live, fires each of
 * the nine surf behaviors manually from the panel — one at a time, mirroring
 * the sterile engine's own strictly-sequential steer handling — and steps the
 * course page back and forth.
 *
 * This module owns the iframe↔cockpit `bsb:behaviorStart`/`bsb:behaviorEnd`/
 * `bsb:pageAffordances` message handshake and the countdown ticker that
 * drives the running chip's `MM:SS` display; the pure gating/formatting rules
 * it wires against live in {@link ./SurfSteer}. `resetSurfSteer` is a plain
 * function (not a `StorePart` action), for the same reason
 * {@link ./BatteryOverrideStore}'s `resetBatteryOverride` is: the panel's
 * cross-cutting Reset button ({@link ./ResetStore}) composes it directly.
 */

import { getElement } from '@wordpress/interactivity';
import { type StorePart } from '../cockpit/StoreParts';
import {
	isBehaviorStartMessage,
	behaviorKeyOf,
	durationOf,
} from '../cockpit/BehaviorStart';
import { isBehaviorEndMessage } from '../cockpit/BehaviorEnd';
import {
	isPageAffordancesMessage,
	affordancesOf,
} from '../cockpit/PageAffordances';
import { postSteerBehavior } from '../cockpit/SteerBehavior';
import { current } from './DevtoolsStore';
import {
	isChipDisabled,
	isChipGated,
	surfCountdownDisplay,
	affordanceGlyphs,
} from './SurfSteer';

/** How often the countdown ticker re-evaluates the running behavior's remaining time. */
const TICK_MS = 1000;

/** The interval id driving the countdown while a behavior with an announced duration runs, or undefined while idle. */
let countdownTicker: ReturnType< typeof setInterval > | undefined;

/**
 * The currently-running steered behavior's FULL announced duration, in ms —
 * fixed for the whole run so the chip tide's `--chip-dur` custom property
 * stays stable while running (never fed the ticking `remainingMs`, which
 * would restart the CSS fill animation every second). Null while idle or
 * for a non-announcing (mechanical) behavior. Kept off reactive state
 * entirely, the same way `./DischargeSimStore`'s ticker id is — this value
 * only ever feeds a getter that reads it fresh each render.
 */
let runningDurationMs: number | null = null;

/** Monotonic sequence stamped onto every `pageStep` command, so the production watch (which reads it reactively) re-fires even on a repeat of the same delta. */
let pageStepSeq = 0;

/** Stops the countdown ticker, idempotently. */
const stopCountdownTicker = (): void => {
	if ( countdownTicker !== undefined ) {
		clearInterval( countdownTicker );
		countdownTicker = undefined;
	}
};

/** Ticks the running behavior's countdown down by one second, stopping itself once idle. */
const tickCountdown = (): void => {
	const surf = current().surf;

	if ( surf.remainingMs === null ) {
		stopCountdownTicker();
		return;
	}

	surf.remainingMs = Math.max( 0, surf.remainingMs - TICK_MS );
};

/** Starts the countdown ticker, idempotently. */
const startCountdownTicker = (): void => {
	if ( countdownTicker !== undefined ) {
		return;
	}

	countdownTicker = setInterval( tickCountdown, TICK_MS );
};

/**
 * Clears the running-behavior fields back to idle: the behavior key, its
 * countdown, and the fixed duration feeding the chip tide's CSS custom
 * property. Shared by the `bsb:behaviorEnd` handler and {@link resetSurfSteer}.
 */
const clearRunning = (): void => {
	stopCountdownTicker();
	runningDurationMs = null;
	const surf = current().surf;
	surf.behaviorKey = '';
	surf.remainingMs = null;
};

/**
 * Resets the Surf tool: disarms the sterile override and clears the tool's
 * own runtime fields. Exported (rather than folded into a `StorePart`
 * action) so the panel's cross-cutting Reset button ({@link ./ResetStore})
 * can call it directly without a second store member.
 *
 * Deliberately never touches `surf.runLive`: unlike `affordances`/`pageStep`/
 * `pageIndex` (this tool's own view of the live page, harmlessly blanked
 * until the next reactive watch run repopulates them), `runLive` is the
 * production-owned truth the Natural/Sterile seg's lock reads directly —
 * resetting it to `false` while a run is still live would wrongly unlock the
 * seg mid-run, the exact bug the lock exists to prevent.
 */
export const resetSurfSteer = (): void => {
	clearRunning();
	const surf = current().surf;
	surf.sterile = false;
	surf.affordances = null;
	surf.pageStep = null;
};

/**
 * The behavior key a chip (or, for the stepper, the triggering button)
 * belongs to, read off `data-devtools-behavior`. Every getter and action
 * below that needs to know which chip it was called for reads it the same
 * way, via `getElement()` — valid inside derived state as well as actions,
 * since `data-wp-bind`/`data-wp-class`/`data-wp-on` directives all evaluate
 * within the triggering element's own scope.
 * @return The element's own `data-devtools-behavior`, or '' when absent.
 */
const chipKey = (): string => {
	const { ref } = getElement();

	return ( ref as HTMLElement | null )?.dataset.devtoolsBehavior ?? '';
};

/** The Surf section of the dev-tools panel, joining `bsb/cockpit`. */
export const surfSteerStore: StorePart = {
	state: {
		/** Whether the Natural/Sterile seg's Natural option is selected. */
		get devtoolsIsSurfNatural(): boolean {
			return ! current().surf.sterile;
		},

		/** Whether the Natural/Sterile seg's Sterile option is selected — the armed override. */
		get devtoolsIsSurfSterile(): boolean {
			return current().surf.sterile;
		},

		/** Whether a steered behavior is currently running — drives the group-head countdown's visibility. */
		get devtoolsSurfIsRunning(): boolean {
			return current().surf.behaviorKey !== '';
		},

		/** The group-head countdown text: `key · MM:SS`, or the bare key for a mechanical behavior. */
		get devtoolsSurfCountdownDisplay(): string {
			const { behaviorKey, remainingMs } = current().surf;

			return surfCountdownDisplay( behaviorKey, remainingMs );
		},

		/** The page stepper's mono glyph readout: which affordance flags the live sterile page reports, or an em dash when there is none. */
		get devtoolsSurfAffordanceGlyphs(): string {
			return affordanceGlyphs( current().surf.affordances );
		},

		/**
		 * Whether the calling chip (its own `data-devtools-behavior`) should be
		 * disabled: no live sterile page, a behavior already running, or this
		 * chip's own hard affordance gate failing.
		 */
		get devtoolsSurfChipDisabled(): boolean {
			return isChipDisabled( chipKey(), current().surf );
		},

		/**
		 * Whether the calling chip's own hard affordance gate fails on the
		 * live sterile page — the strike-through treatment, distinct from a
		 * chip that is merely disabled because there is no live page at all or
		 * another behavior is busy. Stays true for a gated chip even while
		 * another behavior is running (the gate is a property of the page, not
		 * of the panel's current activity).
		 */
		get devtoolsSurfChipGated(): boolean {
			return isChipGated( chipKey(), current().surf.affordances );
		},

		/** Whether the calling chip is the one currently running — drives its `is-running` class and tide fill. */
		get devtoolsSurfChipRunning(): boolean {
			const key = chipKey();

			return key !== '' && key === current().surf.behaviorKey;
		},

		/**
		 * The calling chip's tide-fill duration, as a CSS time value, for its
		 * `--chip-dur` custom property — `0ms` unless this chip is the one
		 * currently running. Fed from the fixed full duration captured at
		 * `bsb:behaviorStart`, never the ticking countdown, so the fill
		 * animates smoothly instead of restarting every second.
		 */
		get devtoolsSurfChipDurationCss(): string {
			const key = chipKey();

			if ( key === '' || key !== current().surf.behaviorKey ) {
				return '0ms';
			}

			return `${ runningDurationMs ?? 0 }ms`;
		},

		/**
		 * Whether the page stepper's prev/next buttons are disabled: no live
		 * sterile page to jump around on (same gate the chips use), or a
		 * behavior already running.
		 */
		get devtoolsSurfStepDisabled(): boolean {
			const { affordances, behaviorKey } = current().surf;

			return affordances === null || behaviorKey !== '';
		},
	},
	actions: {
		/**
		 * Arms or disarms the sterile override from the seg option's
		 * `data-devtools-surf-mode` (`natural` | `sterile`). A no-op while any
		 * run is live (`runLive`) — the seg's own `disabled` binding already
		 * keeps this from firing by a real click, but a forced/tampered call
		 * is guarded the same way.
		 */
		devtoolsSurfSetMode(): void {
			if ( current().surf.runLive ) {
				return;
			}

			const { ref } = getElement();
			const choice = ( ref as HTMLElement | null )?.dataset
				.devtoolsSurfMode;

			if ( choice !== 'natural' && choice !== 'sterile' ) {
				return;
			}

			current().surf.sterile = choice === 'sterile';
		},

		/**
		 * Steers the chip's own behavior: posts `bsb:steerBehavior` to the
		 * viewport iframe's `contentWindow` with the page origin. A no-op when
		 * the chip carries no behavior key or the viewport iframe is absent —
		 * the disabled binding already keeps this from firing without a live
		 * sterile page, but a forced/tampered call is guarded the same way.
		 */
		devtoolsSurfSteer(): void {
			const key = chipKey();

			if ( key === '' ) {
				return;
			}

			const iframe = document.querySelector< HTMLIFrameElement >(
				'.bsb-cockpit__viewport'
			);

			postSteerBehavior(
				iframe?.contentWindow ?? null,
				window.location.origin,
				key
			);
		},

		/**
		 * Writes a page-jump command from the stepper button's own `data-step`
		 * (`-1` | `1`), stamped with a fresh monotonic sequence so the
		 * production watch re-fires even on a repeat of the same direction.
		 */
		devtoolsSurfStep(): void {
			const { ref } = getElement();
			const raw = ( ref as HTMLElement | null )?.dataset.step;

			let delta: -1 | 1 | null = null;
			if ( raw === '-1' ) {
				delta = -1;
			} else if ( raw === '1' ) {
				delta = 1;
			}

			if ( delta === null ) {
				return;
			}

			pageStepSeq += 1;
			current().surf.pageStep = { delta, seq: pageStepSeq };
		},
	},
	callbacks: {
		/**
		 * Attaches the iframe↔cockpit message listener for the sterile engine's
		 * three messages: `bsb:behaviorStart` (sets the running key and starts
		 * its countdown, when the behavior announced a duration),
		 * `bsb:behaviorEnd` (clears the running key and stops the countdown),
		 * and `bsb:pageAffordances` (stores the freshly-sensed page's
		 * affordance flags). Bound via `data-wp-init` on the panel region, so
		 * it stays attached for the panel's whole lifetime regardless of
		 * open/closed — the same convention as the panel's own
		 * `devtoolsPersist` watch.
		 *
		 * @return A cleanup that detaches the listener and stops the ticker.
		 */
		devtoolsInitSurf(): () => void {
			const onMessage = ( event: MessageEvent ): void => {
				const origin = window.location.origin;

				if ( isBehaviorStartMessage( event, origin ) ) {
					const key = behaviorKeyOf( event );

					if ( key === '' ) {
						return;
					}

					const duration = durationOf( event );
					runningDurationMs = duration;
					const surf = current().surf;
					surf.behaviorKey = key;
					surf.remainingMs = duration;
					startCountdownTicker();
					return;
				}

				if ( isBehaviorEndMessage( event, origin ) ) {
					// A mechanical behavior (never announced) never set the
					// running key in the first place; clearing it regardless
					// is a harmless no-op in that case.
					clearRunning();
					return;
				}

				if ( isPageAffordancesMessage( event, origin ) ) {
					current().surf.affordances = affordancesOf( event );
				}
			};

			window.addEventListener( 'message', onMessage );

			return () => {
				window.removeEventListener( 'message', onMessage );
				stopCountdownTicker();
			};
		},
	},
};
