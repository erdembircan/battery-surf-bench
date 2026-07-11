/**
 * Entry point for the settings screen's surf-course order picker.
 *
 * Mounts the app into the container the PHP screen renders, using the
 * configuration it localized onto the page — the same guarded-mount pattern
 * `src/sessions/index.tsx` uses. Wrapped in the shared `ErrorBoundary` so a
 * render-time crash falls back to a `<Notice>` instead of a blank screen.
 */

import { createRoot } from '@wordpress/element';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { SettingsApp } from './App';
import './style.scss';

const container = document.getElementById( 'bsb-settings-app' );

if ( container && window.bsbSettings ) {
	createRoot( container ).render(
		<ErrorBoundary>
			<SettingsApp config={ window.bsbSettings } />
		</ErrorBoundary>
	);
}
