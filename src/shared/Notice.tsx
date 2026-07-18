/**
 * A free-text, dismissible admin message, shaped and animated identically to
 * the cockpit's front-end toast.
 *
 * The cockpit's toast (`src/cockpit/Toasts.ts` + `ToastStore.ts` +
 * `CockpitView.php`'s markup) only ever shows one of a fixed, server-seeded set
 * of strings by `kind`. The admin screens need free text (a fetch failure, a
 * save result, an error boundary's fallback), so this is a plain React
 * component rather than a port of that Interactivity-bound machinery — but it
 * renders the exact same visual shape and plays the exact same enter/leave
 * motion, both extended/sourced from the shared `%bsb-toast` placeholder
 * (`src/styles/theme/_toast.scss`) the cockpit toast also extends, so the two are
 * pixel- and motion-identical.
 *
 * Every kind gets its own colour + icon "shape" (never a bare, unstyled
 * string): `error` reuses the cockpit's coral/warning treatment, `info` reuses
 * its teal/padlock treatment, and `success` (new here) is a teal-green check.
 * Each call site owns a single, directly-controlled notice — there is no
 * internal queue like the cockpit's `ToastQueue`, since no admin surface this
 * milestone introduces ever needs to show more than one notice at a time.
 *
 * Unlike the cockpit's pill, which is driven by an Interactivity store's
 * `toastPhase` context value, this component owns its own small phase state
 * machine locally (`entering` → `holding` → `leaving`), keyed off the
 * `visible` prop rather than a queue: a caller mounts it once and only ever
 * flips `visible` to request the exit motion, calling `onExited` once it has
 * actually finished playing. The caller — not this component — decides when to
 * stop rendering it, exactly the way the cockpit's own pill stays mounted
 * (just `[hidden]`) through its own leave animation.
 */

import { useEffect, useRef, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/** The notice's visual/semantic kind — each renders its own colour and icon. */
export type NoticeKind = 'error' | 'info' | 'success';

/**
 * The notice's animation phase, mirroring the cockpit pill's own
 * `toastPhase` (`ToastStore.ts`) and driving the same `is-entering`/
 * `is-holding`/`is-leaving` classes the shared `%bsb-toast` placeholder
 * animates off of.
 */
type NoticePhase = 'entering' | 'holding' | 'leaving';

/**
 * How long to wait for the leave animation's `animationend` before forcing
 * the exit callback anyway — comfortably longer than the shared
 * `bsb-toast-out` keyframe's own duration (320ms) so the real event always
 * wins when the browser fires it; this only rescues environments (or a
 * `display: none` ancestor) where it never does.
 */
const LEAVE_FALLBACK_MS = 400;

/**
 * Renders a single free-text notice in the shared toast shape, with the
 * shared enter/leave motion.
 *
 * @param props              Component props.
 * @param props.kind         The notice's severity — selects its colour and icon.
 * @param props.message      The free-text message to show.
 * @param props.visible      Whether the notice should be shown (entering/resting) or should play its leave animation. Defaults to `true` for callers with no dismiss lifecycle of their own (e.g. the error boundary's static fallback).
 * @param props.onDismiss    Called when the dismiss button is activated. Omit to render without a dismiss control.
 * @param props.onExited     Called once the leave animation (triggered by `visible` turning `false`) has finished playing — the caller should stop rendering this notice at that point, not the instant `visible` changes.
 * @param props.dismissLabel The dismiss button's accessible label, translated by the caller. Defaults to a generic "Dismiss".
 */
export function Notice( {
	kind,
	message,
	visible = true,
	onDismiss,
	onExited,
	dismissLabel,
}: {
	kind: NoticeKind;
	message: string;
	visible?: boolean;
	onDismiss?: () => void;
	onExited?: () => void;
	dismissLabel?: string;
} ) {
	const [ phase, setPhase ] = useState< NoticePhase >( 'entering' );
	// Tracks the last `visible` value this instance already reacted to, so the
	// phase effect below only fires on a genuine flip, never merely because the
	// component re-rendered with the same value.
	const wasVisible = useRef( visible );
	const leaveFallback = useRef< ReturnType< typeof setTimeout > | null >(
		null
	);

	useEffect( () => {
		return () => {
			if ( leaveFallback.current ) {
				clearTimeout( leaveFallback.current );
			}
		};
	}, [] );

	useEffect( () => {
		if ( wasVisible.current === visible ) {
			return;
		}
		wasVisible.current = visible;

		if ( visible ) {
			setPhase( 'entering' );
			return;
		}

		setPhase( 'leaving' );
		leaveFallback.current = setTimeout( () => {
			leaveFallback.current = null;
			onExited?.();
		}, LEAVE_FALLBACK_MS );
		// `onExited` intentionally excluded: callers pass a stable handler, and
		// keying this effect off it too would let an unrelated re-render restart
		// an already-armed fallback timer.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [ visible ] );

	/**
	 * Advances the phase on each animation end: the enter animation settles
	 * into the resting `holding` phase; the leave animation's own end signals
	 * the caller (via `onExited`) that this notice can now actually be removed.
	 */
	function handleAnimationEnd(): void {
		if ( phase === 'entering' ) {
			setPhase( 'holding' );
			return;
		}

		if ( phase === 'leaving' ) {
			if ( leaveFallback.current ) {
				clearTimeout( leaveFallback.current );
				leaveFallback.current = null;
			}
			onExited?.();
		}
	}

	// An error is unexpected and should interrupt assistive tech immediately;
	// info and success are routine updates that can wait their turn.
	const role = kind === 'error' ? 'alert' : 'status';

	return (
		<div
			className={ `bsb-toast is-${ kind } is-${ phase }` }
			role={ role }
			onAnimationEnd={ handleAnimationEnd }
		>
			<span className="bsb-toast__icon" aria-hidden="true" />
			<span className="bsb-toast__msg">{ message }</span>
			{ onDismiss && (
				<button
					type="button"
					className="bsb-toast__close"
					onClick={ onDismiss }
					aria-label={
						dismissLabel ?? __( 'Dismiss', 'battery-surf-bench' )
					}
				/>
			) }
		</div>
	);
}
