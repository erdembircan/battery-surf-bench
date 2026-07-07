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
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import type { OrderEntry, RowBadge, SequenceRow } from './Types';

/** How long the collapse animation runs before the row is actually removed — matches the CSS transition. */
const REMOVE_ANIMATION_MS = 190;

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
 * @param props            Component props.
 * @param props.row        The row to render.
 * @param props.index      The row's 1-based position in the sequence.
 * @param props.isFirst    Whether this is the first row (disables move up).
 * @param props.isLast     Whether this is the last row (disables move down).
 * @param props.isRemoving Whether the row is mid removal-collapse.
 * @param props.onRemove   Called when the row's remove button is activated.
 * @param props.onMoveUp   Called when the row's move-up affordance is activated.
 * @param props.onMoveDown Called when the row's move-down affordance is activated.
 */
function SequenceRowItem( {
	row,
	index,
	isFirst,
	isLast,
	isRemoving,
	onRemove,
	onMoveUp,
	onMoveDown,
}: {
	row: SequenceRow;
	index: number;
	isFirst: boolean;
	isLast: boolean;
	isRemoving: boolean;
	onRemove: () => void;
	onMoveUp: () => void;
	onMoveDown: () => void;
} ) {
	const { attributes, listeners, setNodeRef, transform, transition } =
		useSortable( { id: row.key } );

	const style = {
		transform: CSS.Transform.toString( transform ),
		transition,
	};

	return (
		<div
			ref={ setNodeRef }
			style={ style }
			className={ `bsb-pages-row bsb-pages-row--custom${
				isRemoving ? ' is-removing' : ''
			}` }
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
				disabled={ isFirst }
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
				disabled={ isLast }
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
 * @param props.onRemove  Called with a row's key when its remove button is activated (only fires for removable rows).
 * @param props.onReorder Called with the moved row's key and the key of the row it was dropped onto.
 */
export function SelectedPane( {
	rows,
	onRemove,
	onReorder,
}: {
	rows: SequenceRow[];
	onRemove: ( entry: OrderEntry ) => void;
	onReorder: ( activeKey: string, overKey: string ) => void;
} ) {
	const [ activeKey, setActiveKey ] = useState< string | null >( null );
	const [ removingKey, setRemovingKey ] = useState< string | null >( null );

	// Tracks the in-flight removal timer so it can be cancelled if the pane
	// unmounts (e.g. the whole app navigates away) before the collapse
	// animation finishes — otherwise the timer still fires afterwards and
	// calls `onRemove`/`setRemovingKey` against a component that is gone.
	const removalTimer = useRef< ReturnType< typeof setTimeout > | null >(
		null
	);

	useEffect( () => {
		return () => {
			if ( removalTimer.current ) {
				clearTimeout( removalTimer.current );
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
	 * Starts the row's collapse animation, then commits the removal once it
	 * has finished — so removing a row reads as the same motion language as a
	 * drag reorder rather than an instant snap.
	 *
	 * @param row The row to remove.
	 */
	function handleRemove( row: SequenceRow ): void {
		if ( removingKey ) {
			return;
		}
		setRemovingKey( row.key );
		removalTimer.current = setTimeout( () => {
			removalTimer.current = null;
			onRemove( row.entry );
			setRemovingKey( null );
		}, REMOVE_ANIMATION_MS );
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
								onRemove={ () => handleRemove( row ) }
								onMoveUp={ () =>
									index > 0 &&
									onReorder( row.key, rows[ index - 1 ].key )
								}
								onMoveDown={ () =>
									index < rows.length - 1 &&
									onReorder( row.key, rows[ index + 1 ].key )
								}
							/>
						) ) }
					</div>
				</SortableContext>
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
		</div>
	);
}
