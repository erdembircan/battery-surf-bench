/**
 * The settings screen's surf-course order picker.
 *
 * Ties the Browse pane (the source: the site's own posts and pages, paged and
 * searched server-side) to the Selected pane (the single surf sequence,
 * seeded with the locked bundled pages) and saves the result with a direct
 * `/wp/v2/settings` POST — no custom REST controller, since
 * `register_setting`'s `show_in_rest` schema already expresses the ordered,
 * heterogeneous entries the PHP side validates and heals. The core-data
 * site-settings entity is unsuited here: it is a singleton keyed by
 * `undefined`, not an empty string id, so there is no base record to `edit()`
 * against.
 */

import apiFetch from '@wordpress/api-fetch';
import {
	createPortal,
	useCallback,
	useMemo,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import {
	addUserPage,
	healBundled,
	removeUserPage,
	reorderByKey,
} from './Order';
import { mapOrderToRows } from './RowMapping';
import { BrowsePane } from './BrowsePane';
import { SelectedPane } from './SelectedPane';
import { SaveButton } from './SaveButton';
import { UserPageResolver } from './UserPageResolver';
import type { OrderEntry, ResolvedUserPage, SettingsConfig } from './Types';

/**
 * Renders the settings screen's body and portals the Save button into the
 * PHP-rendered header slot.
 *
 * @param props        Component props.
 * @param props.config The localized screen configuration.
 */
export function SettingsApp( { config }: { config: SettingsConfig } ) {
	const [ order, setOrder ] = useState< OrderEntry[] >( () =>
		healBundled( config.courseOrder, config.bundledCatalog )
	);
	// Seeded from the server-resolved titles so every eligible saved user page
	// paints its real title on first render instead of a raw post id — the
	// resolver below only has to catch up on whatever this could not seed.
	const [ userPages, setUserPages ] = useState<
		Record< number, ResolvedUserPage >
	>( () => ( { ...config.userPages } ) );
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );

	const userIds = useMemo(
		() =>
			order
				.filter(
					(
						entry
					): entry is Extract< OrderEntry, { kind: 'user' } > =>
						entry.kind === 'user'
				)
				.map( ( entry ) => entry.id ),
		[ order ]
	);

	const selectedIds = useMemo( () => new Set( userIds ), [ userIds ] );

	// Only ids the seed and any prior resolution haven't already covered need
	// fetching — on a normal load every eligible saved id was already seeded
	// server-side, so this is empty and the resolver mounts no queries at all.
	const unresolvedIds = useMemo(
		() => userIds.filter( ( id ) => ! userPages[ id ] ),
		[ userIds, userPages ]
	);

	const rows = useMemo(
		() => mapOrderToRows( order, config.bundledCatalog, userPages ),
		[ order, config.bundledCatalog, userPages ]
	);

	const handleResolved = useCallback(
		( info: Record< number, ResolvedUserPage > ) => {
			setUserPages( ( previous ) => ( { ...previous, ...info } ) );
		},
		[]
	);

	/**
	 * Marks the sequence dirty — any further change means the previous save no
	 * longer describes the current sequence.
	 */
	function markDirty(): void {
		setDirty( true );
	}

	/**
	 * Adds a browsed post or page to the end of the sequence.
	 *
	 * @param id    The post id to add.
	 * @param type  The post's type, used for the row's badge until the resolver confirms it.
	 * @param title The post's title, used for the row until the resolver confirms it.
	 */
	function handleAdd( id: number, type: string, title: string ): void {
		setOrder( ( previous ) => addUserPage( previous, id ) );
		setUserPages( ( previous ) => ( {
			...previous,
			[ id ]: { title, type },
		} ) );
		markDirty();
	}

	/**
	 * Removes a user page from the sequence. Bundled entries never reach here —
	 * the Selected pane renders no remove control for them.
	 *
	 * @param entry The order entry to remove.
	 */
	function handleRemove( entry: OrderEntry ): void {
		if ( entry.kind !== 'user' ) {
			return;
		}
		setOrder( ( previous ) => removeUserPage( previous, entry.id ) );
		markDirty();
	}

	/**
	 * Reorders the sequence by dragging or moving one entry onto another's
	 * position.
	 *
	 * @param activeKey Key of the entry being moved.
	 * @param overKey   Key of the entry it was dropped onto.
	 */
	function handleReorder( activeKey: string, overKey: string ): void {
		setOrder( ( previous ) =>
			reorderByKey( previous, activeKey, overKey )
		);
		markDirty();
	}

	/**
	 * Persists the sequence with a direct POST to the core settings endpoint.
	 */
	async function handleSave(): Promise< void > {
		setSaving( true );
		try {
			await apiFetch( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: { [ config.optionKey ]: order },
			} );
			setDirty( false );
		} catch ( error ) {
			// Keep the sequence dirty so the user can retry; surface, don't swallow.
			// eslint-disable-next-line no-console
			console.error( 'Failed to save the test page sequence', error );
		} finally {
			setSaving( false );
		}
	}

	const saveSlot =
		typeof document !== 'undefined'
			? document.querySelector( '.bsb-settings__save-slot' )
			: null;

	return (
		<div className="bsb-settings__body">
			<div className="bsb-settings__container">
				<div className="bsb-settings__section-head">
					<h2 className="bsb-settings__section-title">
						{ __( 'Test Pages', 'battery-surf-bench' ) }
					</h2>
					<p className="bsb-settings__section-desc">
						{ __(
							'Choose which pages the simulated surfer visits during a benchmark. Add your own posts and pages alongside the bundled set.',
							'battery-surf-bench'
						) }
					</p>
				</div>

				<section className="bsb-pages-group bsb-pages-group--custom">
					<div className="bsb-pages-group__head">
						<h3 className="bsb-pages-group__title">
							{ __( 'Test page sequence', 'battery-surf-bench' ) }
						</h3>
					</div>

					<div className="bsb-picker">
						<BrowsePane
							postTypes={ config.postTypes }
							selectedIds={ selectedIds }
							onAdd={ handleAdd }
							initialBrowse={ config.initialBrowse }
						/>
						<SelectedPane
							rows={ rows }
							onRemove={ handleRemove }
							onReorder={ handleReorder }
						/>
					</div>
				</section>
			</div>

			<UserPageResolver
				ids={ unresolvedIds }
				postTypes={ config.postTypes }
				onResolved={ handleResolved }
			/>

			{ saveSlot &&
				createPortal(
					<SaveButton
						dirty={ dirty }
						saving={ saving }
						onSave={ handleSave }
					/>,
					saveSlot
				) }
		</div>
	);
}
