/**
 * The cockpit's navigate/reload guard: deciding whether an active benchmark
 * run is worth halting a page reload or navigation for, and triggering the
 * browser's native leave-confirmation dialog when it is. Reload and
 * navigation both fire `beforeunload`, so arming this once covers both. Only
 * an active run (`running === true`) blocks leaving — the idle cockpit and a
 * finished run's summary have nothing to lose, so neither blocks.
 */

/**
 * Whether an active run is worth halting a navigation for. An active run
 * blocks leaving; the idle cockpit and a finished-run summary (`running ===
 * false`) never do — there is nothing left to lose by navigating away then.
 *
 * @param context         The reactive context, read for its `running` flag alone.
 * @param context.running Whether a benchmark run is currently live.
 */
export const runBlocksExit = ( context: { running: boolean } ): boolean =>
	context.running;

/**
 * Arms the browser's native leave-confirmation dialog for a `beforeunload`
 * event. `preventDefault()` is the modern standard mechanism; `returnValue`
 * is additionally set for legacy Chrome/Edge support (versions before 119),
 * which look at it instead. Neither can customize the dialog's text — every
 * current browser shows only its own generic, non-configurable prompt.
 *
 * @param event                The `beforeunload` event to arm.
 * @param event.preventDefault Cancels the event, the modern standard mechanism.
 * @param event.returnValue    Legacy field some older browsers read instead.
 */
export const confirmExit = ( event: {
	preventDefault: () => void;
	returnValue: boolean;
} ): void => {
	event.preventDefault();
	event.returnValue = true;
};
