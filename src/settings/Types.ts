/**
 * Shared types for the settings screen's surf-course order picker.
 */

/**
 * A bundled page's entry in the surf-course order: the plugin's own catalog
 * page, referenced by its stable slug.
 */
export interface BundledOrderEntry {
	kind: 'bundled';
	slug: string;
}

/**
 * A user page's entry in the surf-course order: a post or page the site owner
 * chose from the browse pane, referenced by its post id.
 */
export interface UserOrderEntry {
	kind: 'user';
	id: number;
}

/**
 * A single entry in the surf-course order — the shape the PHP option and its
 * REST schema persist, in visit order.
 */
export type OrderEntry = BundledOrderEntry | UserOrderEntry;

/**
 * A bundled page as the PHP catalog describes it to the screen.
 */
export interface BundledCatalogEntry {
	slug: string;
	title: string;
}

/**
 * The configuration the PHP screen localizes for the settings app: the
 * selectable post types, the option's REST key, the saved order, and the
 * bundled catalog the order folds into locked rows.
 */
export interface SettingsConfig {
	postTypes: string[];
	optionKey: string;
	courseOrder: OrderEntry[];
	bundledCatalog: BundledCatalogEntry[];
}

/**
 * A post or page as the REST collection returns it, trimmed to the fields the
 * picker reads (`_fields=id,title,link,type`).
 */
export interface ContentRecord {
	id: number;
	title?: { rendered?: string };
	link?: string;
	type: string;
}

/**
 * The type badge a sequence row shows — 'bundled' for the plugin's own pages,
 * or the resolved post type for a user page.
 */
export type RowBadge = 'bundled' | 'page' | 'post';

/**
 * A single row in the Selected pane: an order entry resolved to a title and
 * badge, ready to render.
 */
export interface SequenceRow {
	/** Stable identifier for dnd-kit and React keys (`bundled:<slug>` / `user:<id>`). */
	key: string;
	title: string;
	badge: RowBadge;
	/** Bundled rows are locked against removal, never against reordering. */
	removable: boolean;
	entry: OrderEntry;
}

/** A user page's resolved title and post type, once fetched. */
export interface ResolvedUserPage {
	title: string;
	type: string;
}

declare global {
	interface Window {
		bsbSettings?: SettingsConfig;
	}
}
