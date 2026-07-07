/**
 * The settings screen's surf-course order picker.
 *
 * Ties the Browse pane (the source: the site's own posts and pages, paged and
 * searched server-side) to the Selected pane (the single surf sequence,
 * seeded with the locked bundled pages) and saves the result through the
 * core-data site-settings entity — no custom REST controller, since
 * `register_setting`'s `show_in_rest` schema already expresses the ordered,
 * heterogeneous entries the PHP side validates and heals.
 */

import { useEntityRecord } from '@wordpress/core-data';
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
	const [ userPages, setUserPages ] = useState<
		Record< number, ResolvedUserPage >
	>( {} );
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	const [ saved, setSaved ] = useState( false );

	const { save, edit } = useEntityRecord< Record< string, unknown > >(
		'root',
		'site',
		''
	);

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
	 * Marks the sequence dirty and clears any leftover "Saved" flash — any
	 * further change means the previous save no longer describes the current
	 * sequence.
	 */
	function markDirty(): void {
		setDirty( true );
		setSaved( false );
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
	 * Persists the sequence through the core-data site-settings entity.
	 */
	async function handleSave(): Promise< void > {
		setSaving( true );
		try {
			edit( { [ config.optionKey ]: order } as Record<
				string,
				unknown
			> );
			await save();
			setDirty( false );
			setSaved( true );
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
				ids={ userIds }
				postTypes={ config.postTypes }
				onResolved={ handleResolved }
			/>

			{ saveSlot &&
				createPortal(
					<SaveButton
						dirty={ dirty }
						saving={ saving }
						saved={ saved }
						onSave={ handleSave }
					/>,
					saveSlot
				) }
		</div>
	);
}
