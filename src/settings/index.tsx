/**
 * Entry point for the settings screen's surf-course order picker.
 *
 * Mounts the app into the container the PHP screen renders, using the
 * configuration it localized onto the page — the same guarded-mount pattern
 * `src/sessions/index.tsx` uses.
 */

import { createRoot } from '@wordpress/element';
import { SettingsApp } from './App';
import './style.scss';

const container = document.getElementById( 'bsb-settings-app' );

if ( container && window.bsbSettings ) {
	createRoot( container ).render(
		<SettingsApp config={ window.bsbSettings } />
	);
}
