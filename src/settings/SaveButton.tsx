/**
 * The header's Save button, portaled into the PHP view's empty save slot —
 * the same pattern `SessionsApp` uses to portal its running total into the
 * Sessions header, since only the mounted app knows the sequence's dirty and
 * saving state.
 */

import { __ } from '@wordpress/i18n';

/**
 * Renders the Save button.
 *
 * @param props        Component props.
 * @param props.dirty  Whether the sequence has unsaved changes.
 * @param props.saving Whether a save request is in flight.
 * @param props.onSave Called when the button is activated.
 */
export function SaveButton( {
	dirty,
	saving,
	onSave,
}: {
	dirty: boolean;
	saving: boolean;
	onSave: () => void;
} ) {
	return (
		<button
			type="button"
			className="bsb-admin-pill bsb-admin-pill--solid"
			disabled={ ! dirty || saving }
			onClick={ onSave }
		>
			<span
				className="bsb-admin-pill__icon bsb-admin-pill__icon--save"
				aria-hidden="true"
			/>
			{ saving
				? __( 'Saving…', 'battery-surf-bench' )
				: __( 'Save changes', 'battery-surf-bench' ) }
		</button>
	);
}
