/**
 * Pure operations over the surf-course order.
 *
 * The order is the single, reorderable sequence the Selected pane renders —
 * bundled pages folded in alongside the site owner's own picks. Every
 * operation here is a pure function of the current order (never the DOM,
 * never React state), so the App component's handlers, and the tests below,
 * only ever deal in plain data.
 */

import type { BundledCatalogEntry, OrderEntry } from './Types';

/**
 * Builds the stable identifier an order entry is tracked by — for React keys
 * and as the dnd-kit sortable id.
 *
 * @param entry The order entry.
 * @return The entry's stable key.
 */
export function entryKey( entry: OrderEntry ): string {
	return entry.kind === 'bundled'
		? `bundled:${ entry.slug }`
		: `user:${ entry.id }`;
}

/**
 * Whether a user page is already in the order.
 *
 * @param order The current order.
 * @param id    The post id to look for.
 * @return Whether the id is already present as a user entry.
 */
export function hasUserPage( order: OrderEntry[], id: number ): boolean {
	return order.some( ( entry ) => entry.kind === 'user' && entry.id === id );
}

/**
 * Appends a user page to the end of the order. A no-op when the page is
 * already present, so a duplicate Add click never creates a second row.
 *
 * @param order The current order.
 * @param id    The post id to add.
 * @return The resulting order.
 */
export function addUserPage( order: OrderEntry[], id: number ): OrderEntry[] {
	if ( hasUserPage( order, id ) ) {
		return order;
	}

	return [ ...order, { kind: 'user', id } ];
}

/**
 * Removes a user page from the order. Bundled entries are never matched, so
 * this can never remove a locked row.
 *
 * @param order The current order.
 * @param id    The post id to remove.
 * @return The resulting order.
 */
export function removeUserPage(
	order: OrderEntry[],
	id: number
): OrderEntry[] {
	return order.filter(
		( entry ) => ! ( entry.kind === 'user' && entry.id === id )
	);
}

/**
 * Moves the entry identified by `activeKey` to the position `overKey`
 * currently occupies. A no-op when either key is not found or they match.
 *
 * @param order     The current order.
 * @param activeKey Key of the entry being moved.
 * @param overKey   Key of the entry it is dropped onto.
 * @return The reordered order.
 */
export function reorderByKey(
	order: OrderEntry[],
	activeKey: string,
	overKey: string
): OrderEntry[] {
	if ( activeKey === overKey ) {
		return order;
	}

	const fromIndex = order.findIndex(
		( entry ) => entryKey( entry ) === activeKey
	);
	const toIndex = order.findIndex(
		( entry ) => entryKey( entry ) === overKey
	);

	if ( fromIndex === -1 || toIndex === -1 ) {
		return order;
	}

	const next = order.slice();
	const [ moved ] = next.splice( fromIndex, 1 );
	next.splice( toIndex, 0, moved );

	return next;
}

/**
 * Re-inserts any bundled catalog page missing from the order, appended in
 * catalog order — the client-side mirror of the PHP sanitizer's healing pass,
 * so the Selected pane never renders without every bundled page even before a
 * round trip to the server.
 *
 * @param order   The current order.
 * @param bundled The bundled catalog, in catalog order.
 * @return The healed order.
 */
export function healBundled(
	order: OrderEntry[],
	bundled: BundledCatalogEntry[]
): OrderEntry[] {
	const present = new Set(
		order
			.filter(
				(
					entry
				): entry is Extract< OrderEntry, { kind: 'bundled' } > =>
					entry.kind === 'bundled'
			)
			.map( ( entry ) => entry.slug )
	);

	const missing = bundled
		.filter( ( page ) => ! present.has( page.slug ) )
		.map(
			( page ): OrderEntry => ( { kind: 'bundled', slug: page.slug } )
		);

	return missing.length === 0 ? order : [ ...order, ...missing ];
}
