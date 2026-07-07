/**
 * The header's Save button, portaled into the PHP view's empty save slot —
 * the same pattern `SessionsApp` uses to portal its running total into the
 * Sessions header, since only the mounted app knows the sequence's dirty,
 * saving and saved state.
 */

import { __ } from '@wordpress/i18n';

/**
 * Renders the Save button and its transient "Saved" flash.
 *
 * @param props        Component props.
 * @param props.dirty  Whether the sequence has unsaved changes.
 * @param props.saving Whether a save request is in flight.
 * @param props.saved  Whether to show the "Saved" flash.
 * @param props.onSave Called when the button is activated.
 */
export function SaveButton( {
	dirty,
	saving,
	saved,
	onSave,
}: {
	dirty: boolean;
	saving: boolean;
	saved: boolean;
	onSave: () => void;
} ) {
	return (
		<>
			<span
				className={ `bsb-settings__save-flash${
					saved ? ' is-shown' : ''
				}` }
			>
				{ __( 'Saved', 'battery-surf-bench' ) }
			</span>
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
		</>
	);
}
