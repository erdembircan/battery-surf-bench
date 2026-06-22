/**
 * The summary slice of the cockpit store: the end-of-run report card. Owns the
 * frozen verdict readouts and reason flags, the card flip, the "New run"
 * dismissal back to the startup screen, and the imperative SVG painter that
 * draws the drain chart and postmark (directives cannot run inside SVG at server
 * render, so the summary is painted by hand).
 */

import { getContext, getElement } from '@wordpress/interactivity';
import { type CockpitContext } from './CockpitContext';
import { type StorePart } from './StoreParts';
import { instanceFor } from './RunInstance';
import { type GraphModel } from './DrainGraph';
import { paintGraph } from './GraphSvg';
import { formatClock } from './Format';

/**
 * How long the startup card rests on its picture front after "New run" before it
 * auto-flips to the how-it-works back (revealing the deck) — a beat to register
 * the return to the start, then the deck slides in on its own.
 */
const AUTO_FLIP_DELAY_MS = 1000;

/** The summary slice of the `bsb/cockpit` store. */
export const summaryStore: StorePart = {
	state: {
		/** Whether a run has finished, so the summary card is shown. */
		get isEnded(): boolean {
			return getContext< CockpitContext >().ended;
		},

		/** Whether the summary card is turned to its report back. */
		get isFlipped(): boolean {
			return getContext< CockpitContext >().flipped;
		},

		/** Whether the finished run ran its full duration. */
		get isReasonDuration(): boolean {
			return getContext< CockpitContext >().endReason === 'duration';
		},

		/** Whether the finished run reached its target drop. */
		get isReasonTargetDrop(): boolean {
			return getContext< CockpitContext >().endReason === 'targetDrop';
		},

		/** Whether the finished run was stopped by hand. */
		get isReasonStopped(): boolean {
			return getContext< CockpitContext >().endReason === 'stopped';
		},

		/** Whether the finished run was cut short by plugging in. */
		get isReasonPlugged(): boolean {
			return getContext< CockpitContext >().endReason === 'plugged';
		},

		/** Elapsed run time as `MM:SS`, counting up — the summary's run length. */
		get summaryElapsed(): string {
			return formatClock( getContext< CockpitContext >().elapsed );
		},

		/** The summary's handwritten verdict heading for the end reason. */
		get summaryHeading(): string {
			const context = getContext< CockpitContext >();
			return context.reasonText?.[ context.endReason ]?.head ?? '';
		},

		/** The summary's one-line signature for the end reason. */
		get summarySig(): string {
			const context = getContext< CockpitContext >();
			return context.reasonText?.[ context.endReason ]?.sig ?? '';
		},
	},
	actions: {
		/** Turns the summary card between its picture front and its report back. */
		toggleFlip(): void {
			const context = getContext< CockpitContext >();
			context.flipped = ! context.flipped;
		},

		/**
		 * Dismisses the summary back to the startup screen — the postcard on its
		 * picture front, as at session start — without beginning a run. Clears the
		 * ended and flip state, then, after a short beat, auto-flips the startup
		 * card to its how-it-works back so the deck slides in on its own (saving a
		 * manual re-flip). The auto-flip sets `idleFlipped` explicitly rather than
		 * toggling it: if the user flips by hand during the wait, the timer still
		 * lands on the back instead of undoing their flip.
		 */
		newRun(): void {
			const context = getContext< CockpitContext >();
			const instance = instanceFor();

			context.ended = false;
			context.endReason = '';
			context.flipped = false;
			context.idleFlipped = false;

			if ( instance.idleFlipTimer !== null ) {
				clearTimeout( instance.idleFlipTimer );
			}
			instance.idleFlipTimer = setTimeout( () => {
				context.idleFlipped = true;
				instance.idleFlipTimer = null;
			}, AUTO_FLIP_DELAY_MS ) as unknown as number;
		},
	},
	callbacks: {
		/**
		 * Paints the summary's SVG from the frozen run — the drain-graph paths and
		 * the postmark's verdict text. Done imperatively (rather than with bound
		 * directives) because the Interactivity runtime cannot process directives
		 * inside SVG during server render; driven by `data-wp-watch`, it re-runs
		 * when the run ends or its reason changes.
		 */
		renderSummary(): void {
			const root = getElement().ref as HTMLElement | null;

			if ( ! root ) {
				return;
			}

			const context = getContext< CockpitContext >();

			// Repaint the drain chart from the frozen draw model on context
			// (reactive), so this watch re-runs when the summary is raised.
			const svg = root.querySelector( '.bsb-summary__chart' );
			if ( svg ) {
				const model: GraphModel | null = context.graphJson
					? ( JSON.parse( context.graphJson ) as GraphModel )
					: null;
				paintGraph( svg as SVGElement, model );
			}

			const reason = context.reasonText?.[ context.endReason ];
			const value =
				context.endReason === 'targetDrop'
					? `${ context.targetPercent }%`
					: formatClock( context.elapsed );
			const setText = ( selector: string, text: string ): void => {
				const el = root.querySelector( selector );
				if ( el ) {
					el.textContent = text;
				}
			};
			setText( '.bsb-frank__arc-text', reason?.arc ?? '' );
			setText( '.bsb-frank__val', value );
			setText( '.bsb-frank__unit', reason?.unit ?? '' );
		},
	},
};
