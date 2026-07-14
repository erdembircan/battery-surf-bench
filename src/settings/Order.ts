/**
 * Pure operations over the surf-course order.
 *
 * The order is the single, reorderable sequence the Selected pane renders —
 * bundled pages folded in alongside the site owner's own picks. Every
 * operation here is a pure function of the current order (never the DOM,
 * never React state), so the App component's handlers, and the tests below,
 * only ever deal in plain data.
 */

import type { OrderEntry } from './Types';

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
 * Removes an entry from the order — bundled or user alike, since every row is
 * now removable. Matched by its stable key, so a bundled entry and a user
 * entry can never be confused with one another.
 *
 * @param order The current order.
 * @param entry The entry to remove.
 * @return The resulting order.
 */
export function removeEntry(
	order: OrderEntry[],
	entry: OrderEntry
): OrderEntry[] {
	const key = entryKey( entry );

	return order.filter( ( candidate ) => entryKey( candidate ) !== key );
}

/**
 * Appends a bundled catalog page to the end of the order — how a page removed
 * from the sequence is re-added from the Browse pane's "Built-in" filter. A
 * no-op when the page is already present, so a duplicate Add click never
 * creates a second row.
 *
 * @param order The current order.
 * @param slug  The bundled page's catalog slug.
 * @return The resulting order.
 */
export function addBundledPage(
	order: OrderEntry[],
	slug: string
): OrderEntry[] {
	const alreadyPresent = order.some(
		( entry ) => entry.kind === 'bundled' && entry.slug === slug
	);

	if ( alreadyPresent ) {
		return order;
	}

	return [ ...order, { kind: 'bundled', slug } ];
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
