/**
 * The settings screen's surf-course order picker.
 *
 * Ties the Browse pane (the source: the site's own posts and pages, paged and
 * searched server-side, plus the bundled catalog under its "Built-in" filter)
 * to the Selected pane (the single, fully removable and reorderable surf
 * sequence, seeded on load from the server-sanitized saved order) and saves
 * the result with a direct `/wp/v2/settings` POST — no custom REST
 * controller, since `register_setting`'s `show_in_rest` schema already
 * expresses the ordered, heterogeneous entries the PHP side validates. The
 * core-data site-settings entity is unsuited here: it is a singleton keyed by
 * `undefined`, not an empty string id, so there is no base record to `edit()`
 * against.
 */

import apiFetch from '@wordpress/api-fetch';
import {
	createPortal,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { Notice, type NoticeKind } from '../shared/Notice';
import {
	addBundledPage,
	addUserPage,
	removeEntry,
	reorderByKey,
} from './Order';
import { mapOrderToRows } from './RowMapping';
import { BrowsePane } from './BrowsePane';
import { SelectedPane } from './SelectedPane';
import { SaveButton } from './SaveButton';
import { ResetButton } from './ResetButton';
import { UserPageResolver } from './UserPageResolver';
import type { OrderEntry, ResolvedUserPage, SettingsConfig } from './Types';

/**
 * How long a success toast stays up before auto-dismissing — the same way the
 * removed transient "Saved" flash used to. An error toast, by contrast, sets
 * no timer here and persists until the user dismisses it or its own source
 * clears it (a retry succeeds, a new fetch starts).
 */
const TOAST_SUCCESS_MS = 3500;

/**
 * Which independent surface raised the toast currently showing — so one
 * source's own lifecycle (a save's success timer, a fresh fetch starting)
 * only ever clears or replaces a toast it itself raised, never one raised by
 * the other surface.
 */
type ToastSource = 'save' | 'browse';

/** The single bottom toast the screen can show at a time, if any. */
interface ActiveToast {
	source: ToastSource;
	kind: NoticeKind;
	message: string;
}

/**
 * Whether two toasts describe the same notice (same source, kind and
 * message) — used to tell "still showing the same thing" apart from "should
 * now show something else", since a fresh `ActiveToast` object is created on
 * every raise even when its content happens to match.
 *
 * @param a A toast, or `null` for "nothing".
 * @param b A toast, or `null` for "nothing".
 * @return Whether the two describe the same notice.
 */
function sameToast( a: ActiveToast | null, b: ActiveToast | null ): boolean {
	if ( a === null || b === null ) {
		return a === b;
	}
	return (
		a.source === b.source && a.kind === b.kind && a.message === b.message
	);
}

/**
 * Renders the settings screen's body and portals the Save button into the
 * PHP-rendered header slot.
 *
 * @param props        Component props.
 * @param props.config The localized screen configuration.
 */
export function SettingsApp( { config }: { config: SettingsConfig } ) {
	const [ order, setOrder ] = useState< OrderEntry[] >(
		() => config.courseOrder
	);
	// The last-persisted order — what Reset reverts to, and what a successful
	// save updates to describe the sequence now on the server. Seeded from the
	// same server-sanitized value as `order` itself, since a freshly loaded
	// sequence is (by definition) already what the server last saved.
	const [ savedOrder, setSavedOrder ] = useState< OrderEntry[] >(
		() => config.courseOrder
	);
	// Seeded from the server-resolved titles so every eligible saved user page
	// paints its real title on first render instead of a raw post id — the
	// resolver below only has to catch up on whatever this could not seed.
	const [ userPages, setUserPages ] = useState<
		Record< number, ResolvedUserPage >
	>( () => ( { ...config.userPages } ) );
	const [ dirty, setDirty ] = useState( false );
	const [ saving, setSaving ] = useState( false );
	// The toast that should be showing right now, if any — what every
	// show/clear/dismiss helper below writes to.
	const [ toast, setToast ] = useState< ActiveToast | null >( null );
	// The toast actually mounted in the DOM. Deliberately not always in sync
	// with `toast`: when `toast` is cleared or replaced, the previously mounted
	// Notice stays put and plays its leave animation first (see the effect
	// below) instead of being hard-removed the instant the request changes.
	const [ mountedToast, setMountedToast ] = useState< ActiveToast | null >(
		null
	);
	// A toast that arrived while another was still playing its leave
	// animation — shown once that animation finishes, rather than cutting it
	// short to swap its text mid-flight.
	const pendingToastRef = useRef< ActiveToast | null >( null );

	// Warns before a reload/navigate discards unsaved changes — armed only
	// while there is something to lose and no save is already resolving it.
	useEffect( () => {
		if ( ! dirty || saving ) {
			return;
		}

		function handleBeforeUnload( event: BeforeUnloadEvent ): void {
			event.preventDefault();
			// Chrome only shows its native leave-confirmation when `returnValue`
			// is explicitly set; the string itself is never actually displayed
			// (every browser shows its own fixed wording).
			event.returnValue = '';
		}

		window.addEventListener( 'beforeunload', handleBeforeUnload );
		return () =>
			window.removeEventListener( 'beforeunload', handleBeforeUnload );
	}, [ dirty, saving ] );

	// Backs a success toast's auto-dismiss; an error toast sets no timer here,
	// so it persists until dismissed or cleared by its own source.
	const toastTimer = useRef< ReturnType< typeof setTimeout > | null >( null );

	useEffect( () => {
		return () => {
			if ( toastTimer.current ) {
				clearTimeout( toastTimer.current );
			}
		};
	}, [] );

	// Keeps `mountedToast` — and so the Notice below — in step with `toast`,
	// but never by hard-swapping it: a clear (`toast` → `null`) or a
	// replacement (`toast` → different content) only ever queues the change in
	// `pendingToastRef`; `handleToastExited` is what actually applies it, once
	// the currently mounted Notice reports its leave animation has finished.
	useEffect( () => {
		if ( toast === null ) {
			pendingToastRef.current = null;
			return;
		}
		if ( mountedToast === null ) {
			setMountedToast( toast );
			return;
		}
		if ( sameToast( toast, mountedToast ) ) {
			return;
		}
		pendingToastRef.current = toast;
	}, [ toast, mountedToast ] );

	/**
	 * Advances the mounted Notice once its leave animation finishes: shows
	 * whatever toast arrived while it was leaving, if any, or clears the
	 * bottom layer entirely.
	 */
	function handleToastExited(): void {
		const pending = pendingToastRef.current;
		pendingToastRef.current = null;
		setMountedToast( pending );
	}

	/**
	 * Shows a toast from the given source, replacing whatever was showing
	 * (from either source) — only one toast is ever on screen at a time,
	 * matching the cockpit's own one-at-a-time toast.
	 *
	 * @param next          The toast to show.
	 * @param autoDismissMs Milliseconds before it auto-dismisses, or omit for a toast that persists until dismissed/cleared.
	 */
	function showToast( next: ActiveToast, autoDismissMs?: number ): void {
		if ( toastTimer.current ) {
			clearTimeout( toastTimer.current );
			toastTimer.current = null;
		}
		setToast( next );
		if ( autoDismissMs ) {
			toastTimer.current = setTimeout( () => {
				toastTimer.current = null;
				// Only clear it if it's still the same toast this timer was armed
				// for — the other source may have replaced it since.
				setToast( ( current ) =>
					current?.source === next.source ? null : current
				);
			}, autoDismissMs );
		}
	}

	/**
	 * Clears the showing toast, but only if it belongs to the given source —
	 * a no-op against a toast the other source raised.
	 *
	 * @param source The source whose own toast should be cleared.
	 */
	function clearToastFor( source: ToastSource ): void {
		setToast( ( current ) => {
			if ( current?.source !== source ) {
				return current;
			}
			if ( toastTimer.current ) {
				clearTimeout( toastTimer.current );
				toastTimer.current = null;
			}
			return null;
		} );
	}

	/** Dismisses the showing toast outright, from either source. */
	function dismissToast(): void {
		if ( toastTimer.current ) {
			clearTimeout( toastTimer.current );
			toastTimer.current = null;
		}
		setToast( null );
	}

	/**
	 * Reflects the Browse pane's fetch-error state into the shared toast: a
	 * failure raises a persistent error toast; a subsequent fetch starting (or
	 * succeeding) clears it, but only if it's still showing.
	 *
	 * @param isError Whether the Browse pane's most recent request failed.
	 */
	const handleFetchError = useCallback( ( isError: boolean ): void => {
		if ( isError ) {
			showToast( {
				source: 'browse',
				kind: 'error',
				message: __(
					"Couldn't load content — try again.",
					'battery-surf-bench'
				),
			} );
		} else {
			clearToastFor( 'browse' );
		}
	}, [] );

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

	const selectedBundledSlugs = useMemo(
		() =>
			new Set(
				order
					.filter(
						(
							entry
						): entry is Extract<
							OrderEntry,
							{ kind: 'bundled' }
						> => entry.kind === 'bundled'
					)
					.map( ( entry ) => entry.slug )
			),
		[ order ]
	);

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
	 * Adds a browsed post or page to the end of the sequence. Guarded at this
	 * level (not just via disabled controls in the panes) so a change can
	 * never land while a save of the previous sequence is still in flight,
	 * regardless of which UI path tried to trigger it.
	 *
	 * @param id    The post id to add.
	 * @param type  The post's type, used for the row's badge until the resolver confirms it.
	 * @param title The post's title, used for the row until the resolver confirms it.
	 */
	function handleAdd( id: number, type: string, title: string ): void {
		if ( saving ) {
			return;
		}
		setOrder( ( previous ) => addUserPage( previous, id ) );
		setUserPages( ( previous ) => ( {
			...previous,
			[ id ]: { title, type },
		} ) );
		markDirty();
	}

	/**
	 * Adds a bundled catalog page back into the sequence — how a page removed
	 * from the sequence is re-added from the Browse pane's "Built-in" filter.
	 * Its title is already known from `config.bundledCatalog`, so no
	 * `userPages` entry is needed the way {@link handleAdd} needs one.
	 *
	 * @param slug The bundled page's catalog slug to add.
	 */
	function handleAddBundled( slug: string ): void {
		if ( saving ) {
			return;
		}
		setOrder( ( previous ) => addBundledPage( previous, slug ) );
		markDirty();
	}

	/**
	 * Removes an entry — bundled or user alike, since every row is now
	 * removable — from the sequence. Guarded against a save in flight for the
	 * same reason {@link handleAdd} is.
	 *
	 * @param entry The order entry to remove.
	 */
	function handleRemove( entry: OrderEntry ): void {
		if ( saving ) {
			return;
		}
		setOrder( ( previous ) => removeEntry( previous, entry ) );
		markDirty();
	}

	/**
	 * Reorders the sequence by dragging or moving one entry onto another's
	 * position. Guarded against a save in flight for the same reason
	 * {@link handleAdd} is.
	 *
	 * @param activeKey Key of the entry being moved.
	 * @param overKey   Key of the entry it was dropped onto.
	 */
	function handleReorder( activeKey: string, overKey: string ): void {
		if ( saving ) {
			return;
		}
		setOrder( ( previous ) =>
			reorderByKey( previous, activeKey, overKey )
		);
		markDirty();
	}

	/**
	 * Persists the sequence with a direct POST to the core settings endpoint.
	 * Surfaces the outcome as a bottom toast: success auto-dismisses like the
	 * transient flash it replaces, failure persists so it can't be missed.
	 */
	async function handleSave(): Promise< void > {
		setSaving( true );
		clearToastFor( 'save' );
		try {
			await apiFetch( {
				path: '/wp/v2/settings',
				method: 'POST',
				data: { [ config.optionKey ]: order },
			} );
			setDirty( false );
			setSavedOrder( order );
			showToast(
				{
					source: 'save',
					kind: 'success',
					message: __( 'Saved', 'battery-surf-bench' ),
				},
				TOAST_SUCCESS_MS
			);
		} catch ( error ) {
			// Keep the sequence dirty so the user can retry; surface, don't swallow.
			// eslint-disable-next-line no-console
			console.error( 'Failed to save the test page sequence', error );
			showToast( {
				source: 'save',
				kind: 'error',
				message: __( 'Save failed — try again.', 'battery-surf-bench' ),
			} );
		} finally {
			setSaving( false );
		}
	}

	/**
	 * Reverts the sequence to the last-persisted order, discarding whatever is
	 * unsaved. Guarded against a save in flight for the same reason
	 * {@link handleAdd} is — reverting mid-save would fight the very order
	 * that save is in the middle of persisting. `userPages` needs no re-seeding
	 * here: it only ever grows (a remove clears an entry from `order`, never
	 * from `userPages`), so any user page reappearing in `savedOrder` already
	 * has its title cached from whenever it was first added or resolved.
	 */
	function handleReset(): void {
		if ( saving ) {
			return;
		}
		setOrder( savedOrder );
		setDirty( false );
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
							"Choose which pages the simulated surfer visits during a benchmark. The five built-in pages that ship with the plugin are added by default — reorder them, or remove any you don't want and add your own posts and pages instead. Find the built-in pages again anytime under the Built-in filter in Browse.",
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
							bundledCatalog={ config.bundledCatalog }
							selectedSlugs={ selectedBundledSlugs }
							saving={ saving }
							onAdd={ handleAdd }
							onAddBundled={ handleAddBundled }
							onFetchError={ handleFetchError }
							initialBrowse={ config.initialBrowse }
						/>
						<SelectedPane
							rows={ rows }
							saving={ saving }
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

			{ /* Reset (secondary, outline) portals in alongside Save (primary,
			solid) — both into the one header slot, so Reset always renders
			right next to Save without needing a second PHP-rendered slot. */ }
			{ saveSlot &&
				createPortal(
					<>
						<ResetButton
							dirty={ dirty }
							saving={ saving }
							onReset={ handleReset }
						/>
						<SaveButton
							dirty={ dirty }
							saving={ saving }
							onSave={ handleSave }
						/>
					</>,
					saveSlot
				) }

			{ /* One bottom toast layer, the same fixed placement — and, via
			Notice's own enter/leave phase, the same animated entrance/exit — as
			the cockpit's front-end toast. A Browse fetch failure and a save's
			success/failure both route here rather than rendering inline near
			whatever triggered them. Kept mounted on `mountedToast`, not `toast`
			directly, so a dismiss/replace plays its leave animation instead of
			vanishing instantly — see the effect above. */ }
			{ mountedToast && (
				<div className="bsb-toast-layer">
					<Notice
						kind={ mountedToast.kind }
						message={ mountedToast.message }
						visible={ sameToast( toast, mountedToast ) }
						onDismiss={ dismissToast }
						onExited={ handleToastExited }
					/>
				</div>
			) }
		</div>
	);
}
