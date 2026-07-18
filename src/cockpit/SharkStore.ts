/**
 * The shark-fin slice of the cockpit store: the Konami-code Easter egg that
 * releases a dorsal fin into the compact topbar's wave strip while a run is
 * live. Reads the swim currently playing off the reactive context (whether
 * one is swimming, its surfacing/diving points and its total duration) and
 * projects them onto the fin's CSS custom properties; listens for the Konami
 * sequence at the document level and releases a shark once it completes
 * while the topbar is armed.
 *
 * Store-authoritative, mirroring {@link ./BarkStore}: the swim's clear timer
 * is owned by {@link ./Shark}, never by the fin's own CSS animation ending.
 * The egg only ARMS while a run is live and the deck is compact — entering
 * the sequence on the expanded deck, or while idle, does nothing — and a
 * live swim is cleared the instant the topbar stops showing (the deck
 * expands, or the run ends), so a hidden fin never resumes mid-swim.
 *
 * No actions — the fin is decorative and non-interactive.
 */

import { getContext } from '@wordpress/interactivity';
import { type CockpitContext } from './CockpitContext';
import { type StorePart } from './StoreParts';
import { instanceFor, now } from './RunInstance';
import { launchShark, clearShark } from './Shark';
import { nextKonamiProgress, isKonamiComplete } from './KonamiCode';

/** The shark-fin slice of the `bsb/cockpit` store. */
export const sharkStore: StorePart = {
	state: {
		/** Whether a shark is currently swimming — drives the fin's visibility. */
		get hasShark(): boolean {
			return getContext< CockpitContext >().sharkSwimming;
		},

		/** The swim's surfacing point, as a CSS percentage. */
		get sharkStartCss(): string {
			return `${ getContext< CockpitContext >().sharkStartPct }%`;
		},

		/** The swim's diving point, as a CSS percentage. */
		get sharkEndCss(): string {
			return `${ getContext< CockpitContext >().sharkEndPct }%`;
		},

		/** The swim's full duration, as a CSS time value. */
		get sharkTotalCss(): string {
			return `${ getContext< CockpitContext >().sharkTotalMs }ms`;
		},
	},
	callbacks: {
		/**
		 * Attaches a single `document`-level `keydown` listener for the
		 * block's lifetime, tracking progress through the Konami sequence and
		 * releasing a shark once it completes. Armed only while a run is live
		 * and the deck is compact (the topbar showing) — outside that window
		 * any progress (and its last-key timestamp) is reset, so a
		 * half-entered code can never carry across an arming boundary. Each
		 * key must follow the previous within `KONAMI_TIMEOUT_MS` or the
		 * sequence starts over (see {@link ./KonamiCode}). A
		 * repeated key (held down) is ignored so it cannot itself advance,
		 * reset, or count toward the timing gap. Never calls
		 * `preventDefault` — the egg must not interfere with normal keyboard
		 * use.
		 *
		 * @return A cleanup that detaches the listener.
		 */
		initShark(): () => void {
			const context = getContext< CockpitContext >();

			const onKeyDown = ( event: KeyboardEvent ): void => {
				if ( event.repeat ) {
					return;
				}

				const instance = instanceFor();

				if ( ! ( context.running && context.compact ) ) {
					instance.konamiProgress = 0;
					instance.konamiLastKeyAt = null;
					return;
				}

				const elapsedMs =
					instance.konamiLastKeyAt === null
						? Number.POSITIVE_INFINITY
						: now() - instance.konamiLastKeyAt;

				instance.konamiProgress = nextKonamiProgress(
					instance.konamiProgress,
					event.key,
					elapsedMs
				);
				instance.konamiLastKeyAt = now();

				if ( isKonamiComplete( instance.konamiProgress ) ) {
					instance.konamiProgress = 0;
					launchShark( context, instance, context.speed );
				}
			};

			document.addEventListener( 'keydown', onKeyDown );

			return () => document.removeEventListener( 'keydown', onKeyDown );
		},

		/**
		 * Clears a swimming shark the instant the topbar stops showing it —
		 * the deck expands, or the run ends — rather than leaving it to
		 * resume mid-swim (with its CSS animations restarted from zero) the
		 * next time the fin is un-hidden.
		 */
		syncSharkCompact(): void {
			const context = getContext< CockpitContext >();

			if (
				context.sharkSwimming &&
				! ( context.running && context.compact )
			) {
				clearShark( context, instanceFor() );
			}
		},
	},
};
