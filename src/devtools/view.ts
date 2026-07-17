/**
 * Dev-tools view — the Interactivity API module that joins the `bsb/cockpit`
 * store to add the floating dev-tools panel. Loaded as its own script module,
 * entirely separate from the cockpit's own `viewScriptModule`, and only ever
 * enqueued by the PHP `DevTools` manager when its environment gate is open —
 * production pages never load this module at all.
 *
 * Thin composition root, same convention as the cockpit's own {@link
 * ../cockpit/view}: fold each dev-tool's store part into one `mergeStoreParts`
 * call and join the existing namespace, so the panel shares the exact same
 * reactive `state` the cockpit reads and writes. A fourth tool is a new
 * StorePart folded in here, not a rework.
 */

import { store } from '@wordpress/interactivity';
import { mergeStoreParts } from '../cockpit/StoreParts';
import { devtoolsShellStore, hydrateDevtools } from './DevtoolsStore';
import { batteryOverrideStore } from './BatteryOverrideStore';
import { dischargeSimStore } from './DischargeSimStore';
import { surfSteerStore } from './SurfSteerStore';
import { resetStore } from './ResetStore';

store(
	'bsb/cockpit',
	mergeStoreParts(
		devtoolsShellStore,
		batteryOverrideStore,
		dischargeSimStore,
		surfSteerStore,
		resetStore
	)
);

// Restore the persisted panel/override state once the slice exists above —
// not tied to a directive, since it needs no DOM, only the store. The
// discharge sim is never part of the persisted shape, so there is nothing of
// its own to resume here.
hydrateDevtools();
