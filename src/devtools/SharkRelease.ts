/**
 * The shark-release dev-tool's pure model: the state shape behind the panel
 * header's shark button. Both fields are live-session-only (never persisted):
 * a released shark is a moment, not a setting. Kept free of any store/DOM
 * dependency, mirroring {@link ./SurfSteer} — the store slice
 * ({@link ./SharkReleaseStore}) only wires this against the shared
 * `bsb/cockpit` state.
 */

/** A shark-launch command the cockpit's own watch consumes once, keyed by a monotonic sequence so a repeat release still re-fires the watch. */
export interface SharkLaunchCommand {
	seq: number;
}

/** The shark-release tool's full state: the pending command plus the launchability mirror. */
export interface SharkReleaseState {
	/** The pending launch command, or null. */
	launch: SharkLaunchCommand | null;
	/**
	 * Whether a shark could actually launch right now — a run live and the
	 * deck compact, the same window the Konami egg arms in. Mirrored from the
	 * cockpit's own context by `SharkStore.syncDevtoolsShark`, never written
	 * on the panel's side; it drives the button's disabled binding.
	 */
	launchable: boolean;
}

/** The tool's default, pre-interaction state: nothing pending, nothing launchable. */
export const DEFAULT_SHARK_RELEASE: SharkReleaseState = {
	launch: null,
	launchable: false,
};
