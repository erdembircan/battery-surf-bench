/**
 * Cockpit view — the Interactivity API store backing the `bsb/cockpit` block.
 *
 * This module is a thin composition root: it folds the cockpit's focused,
 * separately tested domain slices into the single `state` / `actions` /
 * `callbacks` definition the Interactivity API registers under the
 * `bsb/cockpit` namespace, and registers it once. Each slice owns one coherent
 * surface of the control deck and reads from / writes to the per-instance
 * reactive context the block's PHP render seeds:
 *
 * - {@link ./RunStore}      — the live run: viewport URL, clock and rate
 *   readouts, start/stop, compact deck, and the run-scoped clock / heartbeat /
 *   wake-lock effects.
 * - {@link ./ConfigStore}   — run mode, duration stepper (and its odometer),
 *   baseline toggle and surf speed.
 * - {@link ./TargetStore}   — the target-drop battery slider.
 * - {@link ./BatteryStore}  — the live battery readouts and the Battery Status
 *   API wiring that feeds the drain-rate calculations.
 * - {@link ./SoundStore}    — the finish-chime preference and toggle.
 * - {@link ./SummaryStore}  — the end-of-run report card and its painter.
 * - {@link ./StartupStore}  — the session-start postcard and deck reveal.
 * - {@link ./ToastStore}    — the bottom notification pill (upload error /
 *   view-only notice), its queue and lifecycle.
 *
 * The heavy lifting lives below the slices in dedicated, unit-tested domains
 * (theme, target maths, config normalization, formatting, battery acquisition,
 * the drain-rate session, the finish chime); the slices wire those to the store,
 * and the shared run lifecycle ({@link ./RunLifecycle}) and per-instance state
 * ({@link ./RunInstance}) are the seams they hold in common. Keeping this layer
 * thin is deliberate: the Interactivity API makes it easy to pile everything
 * into one file, and the calculations especially must live where they can be
 * unit-tested in isolation.
 */

import { store } from '@wordpress/interactivity';
import { mergeStoreParts } from './StoreParts';
import { runStore } from './RunStore';
import { configStore } from './ConfigStore';
import { targetStore } from './TargetStore';
import { batteryStore } from './BatteryStore';
import { soundStore } from './SoundStore';
import { summaryStore } from './SummaryStore';
import { startupStore } from './StartupStore';
import { toastStore } from './ToastStore';

// Re-exported so the run-state singleton can be reset between tests through the
// store's entry module, without the tests reaching into its private home.
export { __resetInstance } from './RunInstance';

store(
	'bsb/cockpit',
	mergeStoreParts(
		runStore,
		configStore,
		targetStore,
		batteryStore,
		soundStore,
		summaryStore,
		startupStore,
		toastStore
	)
);
