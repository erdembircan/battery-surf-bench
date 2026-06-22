/**
 * Composition for the cockpit store. The store is built from focused domain
 * slices, each contributing part of the single `state` / `actions` / `callbacks`
 * definition the Interactivity API registers under one namespace.
 */

/** One domain's contribution to the cockpit store. */
export interface StorePart {
	state?: object;
	actions?: object;
	callbacks?: object;
}

/** A fully merged store definition, ready to register. */
export interface MergedStore {
	state: object;
	actions: object;
	callbacks: object;
}

/**
 * Merges domain store slices into one definition. `state` is merged by property
 * descriptor — not by value — so reactive getters are carried across as getters
 * rather than invoked and frozen at merge time; `actions` and `callbacks` hold
 * plain methods and merge by reference.
 *
 * @param parts The domain slices to merge, in registration order.
 * @return The single combined store definition.
 */
export const mergeStoreParts = ( ...parts: StorePart[] ): MergedStore => {
	const state: object = {};
	const actions: object = {};
	const callbacks: object = {};

	for ( const part of parts ) {
		if ( part.state ) {
			Object.defineProperties(
				state,
				Object.getOwnPropertyDescriptors( part.state )
			);
		}
		if ( part.actions ) {
			Object.assign( actions, part.actions );
		}
		if ( part.callbacks ) {
			Object.assign( callbacks, part.callbacks );
		}
	}

	return { state, actions, callbacks };
};
