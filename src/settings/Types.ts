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
 * The Browse pane's default first page, seeded server-side by an internal
 * dispatch of the exact same `/wp/v2/search` query the client's own first
 * fetch would run — so the screen paints with data on mount instead of
 * fetching it after the fact.
 */
export interface InitialBrowse {
	records: SearchRecord[];
	totalItems: number;
	totalPages: number;
}

/**
 * The configuration the PHP screen localizes for the settings app: the
 * selectable post types, the option's REST key, the saved order, the bundled
 * catalog the order folds into locked rows, the Browse pane's seeded first
 * page, and each saved user page's title and type, resolved server-side so
 * the sequence paints titles on first render instead of a raw post id.
 */
export interface SettingsConfig {
	postTypes: string[];
	optionKey: string;
	courseOrder: OrderEntry[];
	bundledCatalog: BundledCatalogEntry[];
	initialBrowse: InitialBrowse;
	userPages: Record< number, ResolvedUserPage >;
}

/**
 * A post or page as the `postType` REST collection returns it, trimmed to the
 * fields the user-page resolver reads (`_fields=id,title,type`).
 */
export interface ContentRecord {
	id: number;
	title?: { rendered?: string };
	link?: string;
	type: string;
}

/**
 * A single result from the core `/wp/v2/search` endpoint, trimmed to the
 * fields the Browse pane reads (`_fields=id,title,url,subtype`). Unlike a
 * `postType` collection record, `title` is a plain string and the post type
 * lives in `subtype` (`type` is the generic search result kind — always
 * `'post'` once the query is filtered with `type=post`).
 */
export interface SearchRecord {
	id: number;
	title: string;
	url: string;
	subtype: string;
}

/**
 * The type badge a sequence row shows — 'bundled' for the plugin's own pages,
 * or the resolved post type for a user page.
 */
export type RowBadge = 'bundled' | 'page' | 'post';

/**
 * A single row in the Selected pane: an order entry resolved to a title and
 * badge, ready to render. Every row — bundled or user — is removable and
 * reorderable; there is no locked kind any more.
 */
export interface SequenceRow {
	/** Stable identifier for dnd-kit and React keys (`bundled:<slug>` / `user:<id>`). */
	key: string;
	title: string;
	badge: RowBadge;
	entry: OrderEntry;
}

/** A user page's resolved title and post type, once fetched. */
export interface ResolvedUserPage {
	title: string;
	type: string;
}

declare global {
	interface Window {
		bsbenchSettings?: SettingsConfig;
	}
}
