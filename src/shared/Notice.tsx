/**
 * A free-text, dismissible admin message, shaped identically to the cockpit's
 * front-end toast.
 *
 * The cockpit's toast (`src/cockpit/Toasts.ts` + `ToastStore.ts` +
 * `CockpitView.php`'s markup) only ever shows one of a fixed, server-seeded set
 * of strings by `kind`. The admin screens need free text (a fetch failure, a
 * save result, an error boundary's fallback), so this is a plain React
 * component rather than a port of that Interactivity-bound machinery — but it
 * renders the exact same visual shape, extended from the shared `%bsb-toast`
 * placeholder (`src/styles/_toast.scss`) the cockpit toast also extends, so
 * the two are pixel-identical at rest.
 *
 * Every kind gets its own colour + icon "shape" (never a bare, unstyled
 * string): `error` reuses the cockpit's coral/warning treatment, `info` reuses
 * its teal/padlock treatment, and `success` (new here) is a teal-green check.
 * Each call site owns a single, directly-controlled notice — there is no
 * internal queue like the cockpit's `ToastQueue`, since no admin surface this
 * milestone introduces ever needs to show more than one notice at a time.
 */

import { __ } from '@wordpress/i18n';

/** The notice's visual/semantic kind — each renders its own colour and icon. */
export type NoticeKind = 'error' | 'info' | 'success';

/**
 * Renders a single free-text notice in the shared toast shape.
 *
 * @param props              Component props.
 * @param props.kind         The notice's severity — selects its colour and icon.
 * @param props.message      The free-text message to show.
 * @param props.onDismiss    Called when the dismiss button is activated. Omit to render without a dismiss control.
 * @param props.dismissLabel The dismiss button's accessible label, translated by the caller. Defaults to a generic "Dismiss".
 */
export function Notice( {
	kind,
	message,
	onDismiss,
	dismissLabel,
}: {
	kind: NoticeKind;
	message: string;
	onDismiss?: () => void;
	dismissLabel?: string;
} ) {
	// An error is unexpected and should interrupt assistive tech immediately;
	// info and success are routine updates that can wait their turn.
	const role = kind === 'error' ? 'alert' : 'status';

	return (
		<div className={ `bsb-toast is-${ kind }` } role={ role }>
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
