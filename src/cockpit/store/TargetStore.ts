/**
 * The target-drop slice of the cockpit store: the battery-level slider that sets
 * the stop-at target for a target-drop run. Owns the slider's readout state and
 * its pointer-drag and keyboard interactions, delegating the level maths to
 * {@link ../TargetControl}.
 */

import { getContext, getElement } from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/store/StoreParts';
import {
	TARGET_MIN,
	TARGET_STEP,
	targetCap,
	clampTarget,
	targetFromPointer,
	targetColor,
} from '@/cockpit/TargetControl';

/** Whether a pointer drag on the battery slider is in progress. */
let draggingTarget = false;

/** The target-drop slice of the `bsb/cockpit` store. */
export const targetStore: StorePart = {
	state: {
		/** Target stop-at battery level, as a `NN%` string for the readout/fill. */
		get targetDisplay(): string {
			return `${ getContext< CockpitContext >().targetPercent }%`;
		},

		/** Highest target the slider allows — the current battery level (capped). */
		get targetCap(): number {
			return targetCap( getContext< CockpitContext >().batteryLevel );
		},

		/**
		 * Colour for the target battery fill: green at high levels grading to red
		 * at low ones, so a deeper drain target reads hotter.
		 */
		get targetColor(): string {
			return targetColor( getContext< CockpitContext >().targetPercent );
		},
	},
	actions: {
		/**
		 * Begins a battery-slider drag and sets the level from the pointer.
		 *
		 * @param event The pointer-down event that started the drag.
		 */
		targetPointerDown( event: PointerEvent ): void {
			const el = getElement().ref as HTMLElement;
			const context = getContext< CockpitContext >();
			el.setPointerCapture?.( event.pointerId );
			draggingTarget = true;
			context.targetPercent = targetFromPointer(
				event.clientX,
				el,
				targetCap( context.batteryLevel )
			);
		},

		/**
		 * Tracks the pointer while dragging the battery slider.
		 *
		 * @param event The pointer-move event during the drag.
		 */
		targetPointerMove( event: PointerEvent ): void {
			if ( ! draggingTarget ) {
				return;
			}

			const context = getContext< CockpitContext >();
			context.targetPercent = targetFromPointer(
				event.clientX,
				getElement().ref as HTMLElement,
				targetCap( context.batteryLevel )
			);
		},

		/** Ends a battery-slider drag. */
		targetPointerUp(): void {
			draggingTarget = false;
		},

		/**
		 * Adjusts the target level with the arrow / Home / End keys.
		 *
		 * @param event The keydown event from the slider.
		 */
		targetKeyDown( event: KeyboardEvent ): void {
			const context = getContext< CockpitContext >();
			let next = context.targetPercent;

			switch ( event.key ) {
				case 'ArrowLeft':
				case 'ArrowDown':
					next -= TARGET_STEP;
					break;
				case 'ArrowRight':
				case 'ArrowUp':
					next += TARGET_STEP;
					break;
				case 'Home':
					next = TARGET_MIN;
					break;
				case 'End':
					next = targetCap( context.batteryLevel );
					break;
				default:
					return;
			}

			event.preventDefault();
			context.targetPercent = clampTarget(
				next,
				targetCap( context.batteryLevel )
			);
		},
	},
};
