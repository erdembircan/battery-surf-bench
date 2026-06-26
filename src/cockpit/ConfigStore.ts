/**
 * The run-configuration slice of the cockpit store: the control deck's run mode,
 * duration stepper (with its rolling odometer) and surf speed. Reads and writes
 * the seeded run config on the reactive context, normalising
 * every value through {@link ./RunConfig} so a tampered context cannot push the
 * run outside its supported range.
 */

import { getContext, getElement } from '@wordpress/interactivity';
import { type CockpitContext } from './CockpitContext';
import { type StorePart } from './StoreParts';
import { type Speed, SPEEDS, normalizeDuration } from './RunConfig';
import { durationDigits } from './Format';

/** Per-odometer roll state: the last duration shown and each wheel's position. */
interface OdometerState {
	value: number;
	positions: number[];
}

/** Tracks each cockpit's duration odometer by its element, so the wheels roll. */
const odometers = new WeakMap< HTMLElement, OdometerState >();

/**
 * The transform that rests a wheel strip on a given logical position. The strip
 * repeats 0–9 three times; the middle set (offset 10 cells) is the rest band, so
 * a position can stay small while still rolling through a wrap.
 *
 * @param position The logical wheel position to rest on.
 * @return The CSS transform that seats the strip on that position.
 */
const wheelTransform = ( position: number ): string =>
	`translateY(calc(var(--bsb-od-cell) * ${ -( position + 10 ) }))`;

/** The run-configuration slice of the `bsb/cockpit` store. */
export const configStore: StorePart = {
	state: {
		/** Whether the run is bounded by a fixed duration. */
		get isModeDuration(): boolean {
			return getContext< CockpitContext >().mode === 'duration';
		},

		/** Whether the run is bounded by a target battery drop. */
		get isModeTargetDrop(): boolean {
			return getContext< CockpitContext >().mode === 'targetDrop';
		},

		/** The configured run duration, as text for the stepper readout. */
		get durationDisplay(): string {
			return String( getContext< CockpitContext >().durationMinutes );
		},

		/** Whether the 1× surf speed is selected. */
		get isSpeed1(): boolean {
			return getContext< CockpitContext >().speed === 1;
		},

		/** Whether the 4× surf speed is selected. */
		get isSpeed4(): boolean {
			return getContext< CockpitContext >().speed === 4;
		},

		/** Whether the 10× surf speed is selected. */
		get isSpeed10(): boolean {
			return getContext< CockpitContext >().speed === 10;
		},
	},
	actions: {
		/** Selects the run mode named by the triggering control's `data-mode`. */
		selectMode(): void {
			const { ref } = getElement();
			const mode = ref?.dataset.mode;

			if ( mode === 'duration' || mode === 'targetDrop' ) {
				getContext< CockpitContext >().mode = mode;
			}
		},

		/**
		 * Nudges the run duration by the triggering control's `data-step`
		 * minutes, normalized to the supported range and step.
		 */
		stepDuration(): void {
			const { ref } = getElement();
			const step = Number( ref?.dataset.step );

			if ( ! Number.isFinite( step ) ) {
				return;
			}

			const context = getContext< CockpitContext >();
			context.durationMinutes = normalizeDuration(
				context.durationMinutes + step
			);
		},

		/** Selects the surf speed named by the triggering control's `data-speed`. */
		selectSpeed(): void {
			const { ref } = getElement();
			const speed = Number( ref?.dataset.speed );

			if ( ( SPEEDS as readonly number[] ).includes( speed ) ) {
				getContext< CockpitContext >().speed = speed as Speed;
			}
		},
	},
	callbacks: {
		/**
		 * Rolls the run-duration odometer when the duration changes: each digit
		 * wheel slides to its new value in the press direction (increase rolls up,
		 * decrease rolls down), wrapping 9⇄0 seamlessly, and leading-zero wheels
		 * collapse. Driven by `data-wp-watch`, so it re-runs on every change.
		 */
		rollDuration(): void {
			const element = getElement().ref as HTMLElement | null;

			if ( ! element ) {
				return;
			}

			const { durationMinutes } = getContext< CockpitContext >();
			const strips = element.querySelectorAll< HTMLElement >(
				'.bsb-odometer__strip'
			);
			const wheels = element.querySelectorAll< HTMLElement >(
				'.bsb-odometer__wheel'
			);
			const digits = durationDigits( durationMinutes );

			const state = odometers.get( element );
			const initial = ! state;

			// On the very first run, freeze every transition so the startup seat —
			// both the strip positions and the leading-wheel collapse — lands
			// instantly instead of animating from the default. Transitions are
			// restored next frame so presses animate.
			if ( initial ) {
				strips.forEach( ( strip ) => {
					strip.style.transition = 'none';
				} );
				wheels.forEach( ( wheel ) => {
					wheel.style.transition = 'none';
				} );
			}

			// Collapse leading wheels so there are no leading zeros.
			wheels[ 0 ]?.classList.toggle(
				'is-collapsed',
				durationMinutes < 100
			);
			wheels[ 1 ]?.classList.toggle(
				'is-collapsed',
				durationMinutes < 10
			);

			// First run: seat each wheel on its digit without animating.
			if ( initial ) {
				odometers.set( element, {
					value: durationMinutes,
					positions: [ ...digits ],
				} );
				strips.forEach( ( strip, i ) => {
					strip.style.transform = wheelTransform( digits[ i ]! );
				} );
				void element.offsetHeight;
				requestAnimationFrame( () => {
					strips.forEach( ( strip ) => {
						strip.style.transition = '';
					} );
					wheels.forEach( ( wheel ) => {
						wheel.style.transition = '';
					} );
				} );

				return;
			}

			const direction = Math.sign( durationMinutes - state.value ) || 1;
			const previous = durationDigits( state.value );

			strips.forEach( ( strip, i ) => {
				// Rebase to the previous digit without animating (an invisible jump
				// — same glyph, different repeat) to keep the position bounded,
				// then roll from there toward the new digit in the press direction.
				strip.style.transition = 'none';
				strip.style.transform = wheelTransform( previous[ i ]! );
				void strip.offsetHeight;

				const distance =
					direction > 0
						? ( digits[ i ]! - previous[ i ]! + 10 ) % 10
						: -( ( previous[ i ]! - digits[ i ]! + 10 ) % 10 );
				const target = previous[ i ]! + distance;

				strip.style.transition = '';
				strip.style.transform = wheelTransform( target );
				state.positions[ i ] = target;
			} );

			state.value = durationMinutes;
		},
	},
};
