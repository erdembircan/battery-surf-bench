/**
 * Entry point for the benchmark sessions admin screen.
 *
 * Mounts the DataViews listing into the container the PHP screen renders, using
 * the configuration it localized onto the page. The DataViews stylesheet is
 * bundled here (WordPress exposes no enqueueable handle for it); it is imported
 * through a webpack alias so the dependency-extraction plugin does not mistake
 * it for a WordPress script. The components base styles come from the
 * `wp-components` handle the PHP screen enqueues. Wrapped in the shared
 * `ErrorBoundary` so a render-time crash falls back to a `<Notice>` instead of
 * a blank screen.
 */

import { createRoot } from '@wordpress/element';
import { ErrorBoundary } from '../shared/ErrorBoundary';
import { SessionsApp } from './App';
import 'dataviews-style.css';
import './style.scss';

const container = document.getElementById( 'bsb-sessions-app' );

if ( container && window.bsbSessions ) {
	createRoot( container ).render(
		<ErrorBoundary>
			<SessionsApp config={ window.bsbSessions } />
		</ErrorBoundary>
	);
}
