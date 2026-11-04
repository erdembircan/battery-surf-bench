/**
 * The shark-fin slice of the cockpit store: the Konami-code Easter egg that
 * releases a dorsal fin into the compact topbar's wave strip while a run is
 * live. Reads the swim currently playing off the reactive context (whether
 * one is swimming, its surfacing/diving points and its total duration) and
 * projects them — plus the bob's own √speed-scaled swing period — onto the
 * fin's CSS custom properties; listens for the Konami sequence at the
 * document level and releases a shark once it completes while the topbar is
 * armed.
 * The dev-tools panel's shark button releases one on demand through the same
 * lifecycle: `syncDevtoolsShark` consumes the panel's stamped launch command
 * from inside the block's own scope — the one place `getContext()` reaches
 * the real cockpit context — and mirrors the launch window back for the
 * button to gate on.
 *
 * Store-authoritative, mirroring {@link ./BarkStore}: the swim's clear timer
 * is owned by {@link ../Shark}, never by the fin's own CSS animation ending.
 * The egg only ARMS while a run is live and the deck is compact — entering
 * the sequence on the expanded deck, or while idle, does nothing — and a
 * live swim is cleared the instant the topbar stops showing (the deck
 * expands, or the run ends), so a hidden fin never resumes mid-swim.
 *
 * No actions — the fin is decorative and non-interactive.
 */

import { getContext, store } from '@wordpress/interactivity';
import { type CockpitContext } from '@/cockpit/CockpitContext';
import { type StorePart } from '@/cockpit/store/StoreParts';
import { instanceFor, now } from '@/cockpit/RunInstance';
import { launchShark, clearShark } from '@/cockpit/Shark';
import { nextKonamiProgress, isKonamiComplete } from '@/cockpit/KonamiCode';

/**
 * The slice of the merged `bsb/cockpit` state the shark-release dev-tool
 * contributes, read defensively (production reads `state.devtools`
 * optionally, exactly as {@link ./RunStore}'s `syncDevtoolsSurf` precedent
 * requires — it may not exist at all with no dev-tools module loaded).
 */
interface SharedDevtoolsSharkState {
	devtools?: {
		shark?: {
			/** A pending launch command from the panel's shark button, or null. */
			launch: { seq: number } | null;
			/** Whether a shark could launch right now — mirrored here every watch run, so the panel can disable its button outside the launch window. */
			launchable: boolean;
		};
	};
}

/** The merged store shape the `syncDevtoolsShark` callback re-fetches by namespace. */
interface SharedDevtoolsSharkStore {
	state: SharedDevtoolsSharkState;
}

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

		/**
		 * The bob's own swing period, as a CSS time value — faster on faster
		 * demo speeds, √-scaled the same way the swim's own cruise is.
		 */
		get sharkBobCss(): string {
			const speed = getContext< CockpitContext >().speed;

			return `${ Math.round(
				1700 / Math.sqrt( Math.max( 1, speed ) )
			) }ms`;
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
		 * sequence starts over (see {@link ../KonamiCode}). A
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

		/**
		 * The dev-tools panel's side door into the swim lifecycle. Mirrors
		 * launchability (a run live and the deck compact — the same window
		 * the Konami egg arms in) onto `state.devtools.shark.launchable` for
		 * the panel's button to gate on, and consumes a pending launch
		 * command exactly once (tracked by its monotonic `seq`, so a repeat
		 * release still applies and a command already acted on never
		 * re-fires on an unrelated re-run). A command pending outside the
		 * launch window is cleared instead, so a release forced before a run
		 * (or after one ends) can never surface a fin later once some future
		 * run goes live. Only ever touches `state.devtools` when the
		 * dev-tools module has actually joined the store.
		 */
		syncDevtoolsShark(): void {
			if ( ! BSB_DEV_TOOLS ) {
				return;
			}

			const { state: sharedState } =
				store< SharedDevtoolsSharkStore >( 'bsb/cockpit' );
			const shark = sharedState.devtools?.shark;

			if ( ! shark ) {
				return;
			}

			const context = getContext< CockpitContext >();
			const launchable = context.running && context.compact;
			shark.launchable = launchable;

			const { launch } = shark;

			if ( ! launch ) {
				return;
			}

			if ( ! launchable ) {
				shark.launch = null;
				return;
			}

			const instance = instanceFor();

			if ( launch.seq !== instance.sharkLaunchSeq ) {
				instance.sharkLaunchSeq = launch.seq;
				launchShark( context, instance, context.speed );
			}
		},
	},
};
