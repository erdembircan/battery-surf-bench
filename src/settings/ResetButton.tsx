/**
 * The header's Reset button, portaled alongside the Save button — the
 * sequence's secondary action, so it renders the shared outline pill rather
 * than `SaveButton`'s solid one.
 */

import { __ } from '@wordpress/i18n';

/**
 * Renders the Reset button.
 *
 * @param props         Component props.
 * @param props.dirty   Whether the sequence has unsaved changes — disabled when there is nothing to discard.
 * @param props.saving  Whether a save request is in flight — disabled then too, since resetting mid-save would fight the very order that save is persisting.
 * @param props.onReset Called when the button is activated.
 */
export function ResetButton( {
	dirty,
	saving,
	onReset,
}: {
	dirty: boolean;
	saving: boolean;
	onReset: () => void;
} ) {
	return (
		<button
			type="button"
			className="bsb-admin-pill bsb-admin-pill--outline"
			disabled={ ! dirty || saving }
			onClick={ onReset }
		>
			<span
				className="bsb-admin-pill__icon bsb-admin-pill__icon--reset"
				aria-hidden="true"
			/>
			{ __( 'Reset changes', 'battery-surf-bench' ) }
		</button>
	);
}
