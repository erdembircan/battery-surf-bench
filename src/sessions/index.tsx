/**
 * Entry point for the benchmark sessions admin screen.
 *
 * Mounts the DataViews listing into the container the PHP screen renders, using
 * the configuration it localized onto the page. The DataViews and components
 * stylesheets are WordPress-registered handles the PHP screen enqueues; only
 * this screen's own layout styles are bundled here.
 */

import { createRoot } from '@wordpress/element';
import { SessionsApp } from './App';
import './style.scss';

const container = document.getElementById( 'bsb-sessions-app' );

if ( container && window.bsbSessions ) {
	createRoot( container ).render(
		<SessionsApp config={ window.bsbSessions } />
	);
}
