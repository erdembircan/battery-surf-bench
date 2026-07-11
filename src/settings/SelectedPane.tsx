/**
 * The Selected pane: the single surf-course sequence, seeded with the locked
 * bundled pages and the site owner's own picks, all freely drag-reorderable.
 *
 * Drag-reorder is built on `@dnd-kit` — headless, so the coastal row styling
 * carries over untouched, and its `DragOverlay` reproduces the mock's tilted,
 * lifted clone while `SortableContext` opens the sibling gap at the drop
 * target on its own. Every row also carries a pair of visually-hidden move
 * up/down buttons alongside dnd-kit's own keyboard support (Space/Enter to
 * pick up, arrow keys to move), so reordering is discoverable without relying
 * on a screen reader user finding the drag gesture.
 */

import {
	DndContext,
	DragOverlay,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from '@dnd-kit/core';
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Spinner } from '@wordpress/components';
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import type { OrderEntry, RowBadge, SequenceRow } from './Types';

/** How long the collapse animation runs before the row is actually removed — matches {@link COLLAPSE_TRANSITION}. */
const REMOVE_ANIMATION_MS = 190;

/**
 * A little past {@link REMOVE_ANIMATION_MS} — the fallback that commits a
 * removal even if `transitionend` never fires (e.g. the tab was backgrounded,
 * or a browser quirk), the same margin the approved mock's own fallback uses.
 */
const REMOVE_FALLBACK_MS = REMOVE_ANIMATION_MS + 70;

/**
 * The row's collapse transition, applied inline (not from the stylesheet) and
 * merged with `useSortable()`'s own `transition` value: an element's inline
 * `style.transition` always wins outright over a stylesheet rule for the same
 * property, so if this collapse transition lived in CSS instead, dnd-kit's own
 * inline `transition` (the drag-settle animation) would silently discard it
 * every time it was present. Composing both into one inline value is the only
 * way for the reorder-settle and the remove-collapse animations to coexist.
 */
const COLLAPSE_TRANSITION = [
	'background 0.15s ease',
	`max-height ${ REMOVE_ANIMATION_MS }ms cubic-bezier(0.2, 0, 0, 1)`,
	`opacity ${ REMOVE_ANIMATION_MS }ms cubic-bezier(0.2, 0, 0, 1)`,
	`padding ${ REMOVE_ANIMATION_MS }ms cubic-bezier(0.2, 0, 0, 1)`,
	`margin ${ REMOVE_ANIMATION_MS }ms cubic-bezier(0.2, 0, 0, 1)`,
	`border-top-width ${ REMOVE_ANIMATION_MS }ms cubic-bezier(0.2, 0, 0, 1)`,
].join( ', ' );

/**
 * The translated label for a row's type badge.
 *
 * @param badge The row's badge kind.
 * @return The badge's label.
 */
function badgeLabel( badge: RowBadge ): string {
	if ( badge === 'bundled' ) {
		return __( 'Bundled', 'battery-surf-bench' );
	}
	if ( badge === 'post' ) {
		return __( 'Post', 'battery-surf-bench' );
	}
	return __( 'Page', 'battery-surf-bench' );
}

/**
 * Renders one sequence row: handle, index, lock or spacer, title, badge, and
 * remove or a reserved spacer — every row emits the same six slots so the
 * columns line up regardless of a row's kind.
 *
 * @param props                 Component props.
 * @param props.row             The row to render.
 * @param props.index           The row's 1-based position in the sequence.
 * @param props.isFirst         Whether this is the first row (disables move up).
 * @param props.isLast          Whether this is the last row (disables move down).
 * @param props.isRemoving      Whether the row is mid removal-collapse.
 * @param props.saving          Whether a save is in flight — disables this row's remove/move controls and its drag handle.
 * @param props.onRemove        Called when the row's remove button is activated.
 * @param props.onMoveUp        Called when the row's move-up affordance is activated.
 * @param props.onMoveDown      Called when the row's move-down affordance is activated.
 * @param props.onTransitionEnd Called with each CSS property name as its own transition on this row finishes.
 */
function SequenceRowItem( {
	row,
	index,
	isFirst,
	isLast,
	isRemoving,
	saving,
	onRemove,
	onMoveUp,
	onMoveDown,
	onTransitionEnd,
}: {
	row: SequenceRow;
	index: number;
	isFirst: boolean;
	isLast: boolean;
	isRemoving: boolean;
	saving: boolean;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onTransitionEnd: ( propertyName: string ) => void;
} ) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable( {
		id: row.key,
		// A save in flight disables drag pickup for every row — the code guard
		// in App.tsx would no-op a reorder anyway, but this keeps the pointer
		// from ever starting a drag that visibly can't go anywhere.
		disabled: saving,
		// Matches the mock's SortableJS `animation: 180` exactly, so the
		// gap-open when a sibling slides aside takes the same 180ms rather
		// than dnd-kit's own default (200ms).
		transition: { duration: 180, easing: 'ease' },
	} );

	const style = {
		transform: CSS.Transform.toString( transform ),
		// Both animations have to live in the one `transition` value an inline
		// style resolves to — see {@link COLLAPSE_TRANSITION}.
		transition: transition
			? `${ transition }, ${ COLLAPSE_TRANSITION }`
			: COLLAPSE_TRANSITION,
	};

	return (
		<div
			ref={ setNodeRef }
			style={ style }
			className={ `bsb-pages-row bsb-pages-row--custom${
				isRemoving ? ' is-removing' : ''
			}${ isDragging ? ' is-drag-placeholder' : '' }` }
			onTransitionEnd={ ( event ) =>
				onTransitionEnd( event.propertyName )
			}
		>
			<span
				className="bsb-pages-row__handle"
				aria-label={ sprintf(
					/* translators: %s: page title. */
					__( 'Reorder %s', 'battery-surf-bench' ),
					row.title
				) }
				{ ...attributes }
				{ ...listeners }
			>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
				<span aria-hidden="true"></span>
			</span>
			<span className="bsb-pages-row__index">{ index }</span>
			{ row.badge === 'bundled' ? (
				<span
					className="bsb-pages-row__lock"
					aria-label={ __( 'Locked', 'battery-surf-bench' ) }
				></span>
			) : (
				<span className="bsb-pages-row__lock" aria-hidden="true"></span>
			) }
			<span className="bsb-pages-row__title">{ row.title }</span>
			<span className={ `bsb-badge bsb-badge--${ row.badge }` }>
				{ badgeLabel( row.badge ) }
			</span>
			{ row.removable ? (
				<button
					type="button"
					className="bsb-pages-row__remove"
					aria-label={ sprintf(
						/* translators: %s: page title. */
						__( 'Remove %s', 'battery-surf-bench' ),
						row.title
					) }
					disabled={ saving }
					onClick={ onRemove }
				>
					×
				</button>
			) : (
				<span
					className="bsb-pages-row__remove-spacer"
					aria-hidden="true"
				></span>
			) }
			<button
				type="button"
				className="screen-reader-text"
				disabled={ isFirst || saving }
				onClick={ onMoveUp }
			>
				{ sprintf(
					/* translators: %s: page title. */
					__( 'Move %s up', 'battery-surf-bench' ),
					row.title
				) }
			</button>
			<button
				type="button"
				className="screen-reader-text"
				disabled={ isLast || saving }
				onClick={ onMoveDown }
			>
				{ sprintf(
					/* translators: %s: page title. */
					__( 'Move %s down', 'battery-surf-bench' ),
					row.title
				) }
			</button>
		</div>
	);
}

/**
 * Renders the Selected pane: the ordered surf-course sequence.
 *
 * @param props           Component props.
 * @param props.rows      The sequence rows, in visit order.
 * @param props.saving    Whether a save is in flight — shields the pane and disables every row's remove/move controls and drag.
 * @param props.onRemove  Called with a row's key when its remove button is activated (only fires for removable rows).
 * @param props.onReorder Called with the moved row's key and the key of the row it was dropped onto.
 */
export function SelectedPane( {
	rows,
	saving,
	onRemove,
	onReorder,
}: {
	rows: SequenceRow[];
	saving: boolean;
	onRemove: ( entry: OrderEntry ) => void;
	onReorder: ( activeKey: string, overKey: string ) => void;
} ) {
	const [ activeKey, setActiveKey ] = useState< string | null >( null );
	const [ removingKey, setRemovingKey ] = useState< string | null >( null );

	// The row currently collapsing, and whether its removal has already been
	// committed — read and written from both the `transitionend` handler and
	// the fallback timer below, so whichever fires first wins and the other
	// becomes a no-op instead of committing (or unmounting a gone row) twice.
	const pendingRemoval = useRef< {
		row: SequenceRow;
		settled: boolean;
	} | null >( null );

	// The fallback timer, cancelled once `transitionend` commits first — and,
	// on unmount, cancelled outright so it can never fire `onRemove`/
	// `setRemovingKey` against a component that is gone (e.g. the whole app
	// navigated away mid-collapse).
	const removalFallbackTimer = useRef< ReturnType<
		typeof setTimeout
	> | null >( null );

	useEffect( () => {
		return () => {
			if ( removalFallbackTimer.current ) {
				clearTimeout( removalFallbackTimer.current );
			}
		};
	}, [] );

	const sensors = useSensors(
		useSensor( PointerSensor ),
		useSensor( KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		} )
	);

	/**
	 * Commits the pending removal exactly once — called either by the
	 * removing row's own `transitionend` once its collapse actually finishes,
	 * or by the fallback timer if that event never arrives.
	 */
	function commitPendingRemoval(): void {
		const pending = pendingRemoval.current;
		if ( ! pending || pending.settled ) {
			return;
		}
		pending.settled = true;

		if ( removalFallbackTimer.current ) {
			clearTimeout( removalFallbackTimer.current );
			removalFallbackTimer.current = null;
		}

		pendingRemoval.current = null;
		onRemove( pending.row.entry );
		setRemovingKey( null );
	}

	/**
	 * Starts the row's collapse animation. The removal itself commits once the
	 * collapse's own `transitionend` reaches {@link handleRowTransitionEnd}
	 * (with a timeout fallback), so removing a row reads as the same motion
	 * language as a drag reorder rather than an instant snap.
	 *
	 * @param row The row to remove.
	 */
	function handleRemove( row: SequenceRow ): void {
		if ( removingKey ) {
			return;
		}
		pendingRemoval.current = { row, settled: false };
		setRemovingKey( row.key );
		removalFallbackTimer.current = setTimeout(
			commitPendingRemoval,
			REMOVE_FALLBACK_MS
		);
	}

	/**
	 * Commits the pending removal once its own collapse transition (not some
	 * unrelated one, like a reorder-settle `transform`) actually finishes.
	 * Several properties collapse in parallel ({@see COLLAPSE_TRANSITION}), so
	 * this fires once per property on the removing row; `commitPendingRemoval`
	 * itself is guarded to only ever act on the first of those.
	 *
	 * @param key          Key of the row this event fired on.
	 * @param propertyName The CSS property whose transition just ended.
	 */
	function handleRowTransitionEnd( key: string, propertyName: string ): void {
		if ( removingKey === key && propertyName === 'max-height' ) {
			commitPendingRemoval();
		}
	}

	function handleDragStart( event: DragStartEvent ): void {
		setActiveKey( String( event.active.id ) );
	}

	function handleDragEnd( event: DragEndEvent ): void {
		setActiveKey( null );
		const { active, over } = event;
		if ( over && active.id !== over.id ) {
			onReorder( String( active.id ), String( over.id ) );
		}
	}

	const activeRow = rows.find( ( row ) => row.key === activeKey ) ?? null;

	return (
		<div className="bsb-picker__pane bsb-selected">
			<div className="bsb-picker__pane-head">
				<h4 className="bsb-pages-group__title">
					{ __( 'Selected pages', 'battery-surf-bench' ) }
				</h4>
				<span className="bsb-pages-group__count">
					{ sprintf(
						/* translators: %s: number of pages in the sequence. */
						__( '%s pages', 'battery-surf-bench' ),
						String( rows.length )
					) }
				</span>
			</div>
			<p className="bsb-selected__note">
				{ __(
					"Order matters — the surfer visits these in sequence. Bundled pages can't be removed, but drag them anywhere.",
					'battery-surf-bench'
				) }
			</p>

			<DndContext
				sensors={ sensors }
				collisionDetection={ closestCenter }
				onDragStart={ handleDragStart }
				onDragEnd={ handleDragEnd }
				onDragCancel={ () => setActiveKey( null ) }
			>
				<SortableContext
					items={ rows.map( ( row ) => row.key ) }
					strategy={ verticalListSortingStrategy }
				>
					<div className="bsb-pages-list bsb-pages-list--custom">
						{ rows.map( ( row, index ) => (
							<SequenceRowItem
								key={ row.key }
								row={ row }
								index={ index + 1 }
								isFirst={ index === 0 }
								isLast={ index === rows.length - 1 }
								isRemoving={ removingKey === row.key }
								saving={ saving }
								onRemove={ () => handleRemove( row ) }
								onMoveUp={ () =>
									index > 0 &&
									onReorder( row.key, rows[ index - 1 ].key )
								}
								onMoveDown={ () =>
									index < rows.length - 1 &&
									onReorder( row.key, rows[ index + 1 ].key )
								}
								onTransitionEnd={ ( propertyName ) =>
									handleRowTransitionEnd(
										row.key,
										propertyName
									)
								}
							/>
						) ) }
					</div>
				</SortableContext>
				{ /* dnd-kit's own cursor-following `transform` (translate) lands on
				its OWN internal wrapper element around whatever `DragOverlay`
				is given as children — never merged onto this row div itself —
				so `.bsb-pages-row--dragging`'s `transform: rotate(2.5deg)
				scale(1.02)` below resolves as a clean, standalone value with
				nothing else composed into it, byte-identical to the mock's
				`.bsb-drag-fallback`. Do not attach any inline `style` (or a
				`transform`-setting class) to this element, or the two would
				collide the same way the collapse animation's `transition` did
				in `SequenceRowItem` above. */ }
				<DragOverlay>
					{ activeRow ? (
						<div className="bsb-pages-row bsb-pages-row--custom bsb-pages-row--dragging">
							<span
								className="bsb-pages-row__handle"
								aria-hidden="true"
							>
								<span></span>
								<span></span>
								<span></span>
								<span></span>
								<span></span>
								<span></span>
							</span>
							<span className="bsb-pages-row__index">
								{ rows.findIndex(
									( row ) => row.key === activeRow.key
								) + 1 }
							</span>
							<span
								className="bsb-pages-row__lock"
								aria-hidden="true"
							></span>
							<span className="bsb-pages-row__title">
								{ activeRow.title }
							</span>
							<span
								className={ `bsb-badge bsb-badge--${ activeRow.badge }` }
							>
								{ badgeLabel( activeRow.badge ) }
							</span>
							<span
								className="bsb-pages-row__remove-spacer"
								aria-hidden="true"
							></span>
						</div>
					) : null }
				</DragOverlay>
			</DndContext>

			{ /* Shields the whole pane while a save is in flight — see the same
			overlay on `BrowsePane`. The per-row remove/move buttons and drag
			handle above are also individually disabled; this is the visual +
			interaction backstop. */ }
			{ saving && (
				<div className="bsb-pane-overlay">
					<Spinner />
				</div>
			) }
		</div>
	);
}
