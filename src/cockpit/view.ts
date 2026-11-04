/**
 * Cockpit view — the Interactivity API store backing the `battery-surf-bench/cockpit` block.
 *
 * This module is a thin composition root: it folds the cockpit's focused,
 * separately tested domain slices into the single `state` / `actions` /
 * `callbacks` definition the Interactivity API registers under the
 * `battery-surf-bench/cockpit` namespace, and registers it once. Each slice owns one coherent
 * surface of the control deck and reads from / writes to the per-instance
 * reactive context the block's PHP render seeds:
 *
 * - {@link ./store/RunStore}      — the live run: viewport URL, clock and rate
 *   readouts, start/stop, compact deck, and the run-scoped clock / heartbeat /
 *   wake-lock effects.
 * - {@link ./store/ConfigStore}   — run mode, duration stepper (and its odometer) and
 *   surf speed.
 * - {@link ./store/TraitsStore}   — the surfer personality: the point-buy stat vector,
 *   class presets and the derived archetype that shape the engine's behaviour.
 * - {@link ./store/TargetStore}   — the target-drop battery slider.
 * - {@link ./store/BatteryStore}  — the live battery readouts and the Battery Status
 *   API wiring that feeds the drain-rate calculations.
 * - {@link ./store/SoundStore}    — the finish-chime preference and toggle.
 * - {@link ./store/SummaryStore}  — the end-of-run report card and its painter.
 * - {@link ./store/StartupStore}  — the session-start postcard and deck reveal.
 * - {@link ./store/ToastStore}    — the bottom notification pill (upload error /
 *   view-only notice), its queue and lifecycle.
 * - {@link ./store/BarkStore}     — the playful pill shown over the top of the
 *   running viewport when the surf engine starts a novelty behavior.
 * - {@link ./store/SharkStore}    — the Konami-code Easter egg: a dorsal fin that
 *   swims across the compact topbar's wave strip.
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
import { mergeStoreParts } from '@/cockpit/store/StoreParts';
import { runStore } from '@/cockpit/store/RunStore';
import { configStore } from '@/cockpit/store/ConfigStore';
import { traitsStore } from '@/cockpit/store/TraitsStore';
import { targetStore } from '@/cockpit/store/TargetStore';
import { batteryStore } from '@/cockpit/store/BatteryStore';
import { soundStore } from '@/cockpit/store/SoundStore';
import { summaryStore } from '@/cockpit/store/SummaryStore';
import { startupStore } from '@/cockpit/store/StartupStore';
import { toastStore } from '@/cockpit/store/ToastStore';
import { barkStore } from '@/cockpit/store/BarkStore';
import { sharkStore } from '@/cockpit/store/SharkStore';

// Re-exported so the run-state singleton can be reset between tests through the
// store's entry module, without the tests reaching into its private home.
export { __resetInstance } from '@/cockpit/RunInstance';

store(
	'battery-surf-bench/cockpit',
	mergeStoreParts(
		runStore,
		configStore,
		traitsStore,
		targetStore,
		batteryStore,
		soundStore,
		summaryStore,
		startupStore,
		toastStore,
		barkStore,
		sharkStore
	)
);
