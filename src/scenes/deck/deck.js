/* Drives the static cockpit clone (deck/cockpit-markup.js) frame by frame with
   the product's own state model: chip active state, slider values and track
   gradients (TraitsStore.trackGradient), stat readouts, the point pool, the
   archetype label and the run button's blocked/start/running classes. Requires
   build/style-cockpit-dashboard.css on the page. */
( function () {
	const MIN = 0, MAX = 10, BUDGET = 25;
	const CLASSES = {
		Balanced: [ 5, 5, 5, 5, 5 ],
		Scholar: [ 2, 8, 10, 2, 3 ],
		'Binge-Watcher': [ 3, 7, 2, 10, 3 ],
		Doomscroller: [ 10, 4, 2, 5, 4 ],
		Skimmer: [ 8, 3, 5, 4, 5 ],
		Jitterbug: [ 6, 4, 2, 3, 10 ],
	};
	// src/shared/SurferStats.ts classify(): first match wins.
	function classify( v ) {
		const [ tempo, endurance, literacy, allure, fidget ] = v;
		if ( allure >= 8 && literacy <= 3 ) return 'Binge-Watcher';
		if ( fidget >= 8 && literacy <= 4 ) return 'Jitterbug';
		if ( tempo >= 8 && literacy <= 3 ) return 'Doomscroller';
		if ( tempo >= 6 && endurance <= 4 ) return 'Skimmer';
		if ( literacy >= 8 && tempo <= 3 ) return 'Scholar';
		if ( v.every( ( x ) => x >= 4 && x <= 6 ) ) return 'Balanced';
		return 'Custom';
	}
	function mount( host, { hideStage = false } = {} ) {
		host.innerHTML = window.COCKPIT_HTML;
		const style = document.createElement( 'style' );
		style.textContent = `
			.wp-block-bsb-cockpit, .wp-block-bsb-cockpit * { transition: none !important; animation: none !important; }
			.wp-block-bsb-cockpit { width: 1920px; height: 1080px; min-height: 0 !important; }
			.bsb-cockpit__toast-layer, .bsb-devtools { display: none !important; }
			${ hideStage ? '.bsb-cockpit__idle { visibility: hidden !important; }' : '' }`;
		document.head.appendChild( style );
		const root = host.querySelector( '.wp-block-bsb-cockpit' );
		const chips = [ ...root.querySelectorAll( '.bsb-chip' ) ];
		const sliders = [ ...root.querySelectorAll( '.bsb-stat__slider' ) ];
		const vals = [ ...root.querySelectorAll( '.bsb-stat__val' ) ];
		sliders.forEach( ( s ) => s.setAttribute( 'step', 'any' ) );
		const pool = root.querySelector( '.bsb-surfer__pool' );
		const points = root.querySelector( '.bsb-surfer__points' );
		const build = root.querySelector( '.bsb-surfer__build' );
		const run = root.querySelector( '.bsb-run' );
		const api = {
			root,
			CLASSES,
			classify,
			/** Rect of an element in the clone's own (untransformed) page space. */
			rect( el ) {
				const e = typeof el === 'string' ? root.querySelector( el ) : el;
				const r = e.getBoundingClientRect();
				const h = host.getBoundingClientRect();
				const k = host.offsetWidth ? h.width / host.offsetWidth : 1;
				return { x: ( r.x - h.x ) / k, y: ( r.y - h.y ) / k, w: r.width / k, h: r.height / k };
			},
			chip: ( key ) => chips.find( ( c ) => c.dataset.class === key ),
			slider: ( i ) => sliders[ i ],
			setClass( key ) {
				chips.forEach( ( c ) => {
					const on = c.dataset.class === key;
					c.classList.toggle( 'is-active', on );
					c.setAttribute( 'aria-pressed', on ? 'true' : 'false' );
				} );
			},
			/** Fractional trait vector → sliders, tracks, readouts and pool. */
			setTraits( vec, { label, pool: poolOverride } = {} ) {
				const rounded = vec.map( ( x ) => Math.round( x ) );
				// A preset load is instant in the product, so a swing between two
				// full-budget presets never shows a transient budget.
				const left = poolOverride ?? BUDGET - rounded.reduce( ( a, b ) => a + b, 0 );
				vec.forEach( ( v, i ) => {
					const value = Math.max( MIN, Math.min( MAX, v ) );
					sliders[ i ].value = String( value );
					const ceil = Math.min( MAX, value + Math.max( 0, left ) );
					const filled = ( ( value - MIN ) / ( MAX - MIN ) ) * 100;
					const reach = ( ( ceil - MIN ) / ( MAX - MIN ) ) * 100;
					sliders[ i ].style.background = `linear-gradient(90deg,var(--accent) 0 ${ filled }%,var(--accent-headroom) ${ filled }% ${ reach }%,var(--track) ${ reach }% 100%)`;
					vals[ i ].textContent = String( rounded[ i ] );
				} );
				points.textContent = String( left );
				pool.classList.toggle( 'is-empty', left <= 0 );
				build.textContent = label ?? classify( rounded );
			},
			/** 'blocked' (PLUGGED IN), 'start' (▶ START) or 'running' (STOP). */
			setRun( state ) {
				run.classList.toggle( 'is-blocked', state === 'blocked' );
				run.classList.toggle( 'is-running', state === 'running' );
			},
		};
		return api;
	}
	window.Deck = { mount, CLASSES, classify };
} )();
