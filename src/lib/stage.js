/* Shared scene runtime for the Battery Surf Bench spot.
   Contract: a scene calls S.scene({ dur, assets?, setup?, render(t) }). The
   renderer waits for window.SCENE_READY, then calls SCENE.render(t) once per
   frame (t in seconds, 0 ≤ t < dur) and screenshots. render() must be a pure
   function of t: no CSS transitions/animations, no timers, no randomness that
   isn't seeded. */
( function () {
	const clamp = ( v, a = 0, b = 1 ) => Math.min( b, Math.max( a, v ) );
	const lerp = ( a, b, t ) => a + ( b - a ) * t;
	const E = {
		linear: ( t ) => t,
		inQuad: ( t ) => t * t,
		outQuad: ( t ) => 1 - ( 1 - t ) * ( 1 - t ),
		inOutQuad: ( t ) => ( t < 0.5 ? 2 * t * t : 1 - Math.pow( -2 * t + 2, 2 ) / 2 ),
		inCubic: ( t ) => t * t * t,
		outCubic: ( t ) => 1 - Math.pow( 1 - t, 3 ),
		inOutCubic: ( t ) => ( t < 0.5 ? 4 * t * t * t : 1 - Math.pow( -2 * t + 2, 3 ) / 2 ),
		outQuart: ( t ) => 1 - Math.pow( 1 - t, 4 ),
		inOutQuart: ( t ) => ( t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow( -2 * t + 2, 4 ) / 2 ),
		outQuint: ( t ) => 1 - Math.pow( 1 - t, 5 ),
		inOutQuint: ( t ) => ( t < 0.5 ? 16 * Math.pow( t, 5 ) : 1 - Math.pow( -2 * t + 2, 5 ) / 2 ),
		outExpo: ( t ) => ( t >= 1 ? 1 : 1 - Math.pow( 2, -10 * t ) ),
		inExpo: ( t ) => ( t <= 0 ? 0 : Math.pow( 2, 10 * t - 10 ) ),
		inOutExpo: ( t ) => ( t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow( 2, 20 * t - 10 ) / 2 : ( 2 - Math.pow( 2, -20 * t + 10 ) ) / 2 ),
		inOutSine: ( t ) => -( Math.cos( Math.PI * t ) - 1 ) / 2,
		outSine: ( t ) => Math.sin( ( t * Math.PI ) / 2 ),
		outBack: ( t, s = 1.70158 ) => 1 + ( s + 1 ) * Math.pow( t - 1, 3 ) + s * Math.pow( t - 1, 2 ),
		// Damped spring settle from 0 to 1 (overshoots once, like a wave cresting).
		spring: ( t, k = 7, f = 1.6 ) => ( t <= 0 ? 0 : 1 - Math.exp( -k * t ) * Math.cos( f * Math.PI * 2 * t ) ),
	};
	/** Eased 0..1 progress of t through [a, b]. */
	const prog = ( t, a, b, ease = E.linear ) => ease( clamp( ( t - a ) / ( b - a ) ) );
	/** Keyframes: [[time, value, ease?], ...]; ease applies to the segment ending at that key. Values may be numbers or arrays. */
	function kf( t, keys ) {
		if ( t <= keys[ 0 ][ 0 ] ) return keys[ 0 ][ 1 ];
		for ( let i = 1; i < keys.length; i++ ) {
			const [ t1, v1, ease ] = keys[ i ];
			if ( t <= t1 ) {
				const [ t0, v0 ] = keys[ i - 1 ];
				const p = ( ease || E.inOutCubic )( ( t - t0 ) / ( t1 - t0 || 1 ) );
				return Array.isArray( v0 ) ? v0.map( ( x, k ) => lerp( x, v1[ k ], p ) ) : lerp( v0, v1, p );
			}
		}
		return keys[ keys.length - 1 ][ 1 ];
	}
	const $ = ( sel, root = document ) => root.querySelector( sel );
	const $$ = ( sel, root = document ) => [ ...root.querySelectorAll( sel ) ];
	/** Sets transform/opacity in one call. */
	function tf( el, { x = 0, y = 0, s = 1, sx, sy, r = 0, o, origin } = {} ) {
		el.style.transform = `translate3d(${ x }px, ${ y }px, 0) rotate(${ r }deg) scale(${ sx ?? s }, ${ sy ?? s })`;
		if ( o !== undefined ) el.style.opacity = String( o );
		if ( origin ) el.style.transformOrigin = origin;
	}
	function rng( seed ) {
		return function () {
			seed |= 0;
			seed = ( seed + 0x6d2b79f5 ) | 0;
			let t = Math.imul( seed ^ ( seed >>> 15 ), 1 | seed );
			t = ( t + Math.imul( t ^ ( t >>> 7 ), 61 | t ) ) ^ t;
			return ( ( t ^ ( t >>> 14 ) ) >>> 0 ) / 4294967296;
		};
	}
	/** A filled wave band: crest line at y with amplitude/wavelength/phase, filled down to `bottom`. */
	function wavePath( w, y, amp, len, phase, bottom, step = 8 ) {
		let d = `M0 ${ bottom } L0 ${ ( y + amp * Math.sin( phase ) ).toFixed( 2 ) }`;
		for ( let x = step; x <= w + step; x += step ) {
			const yy = y + amp * Math.sin( ( x / len ) * Math.PI * 2 + phase ) + amp * 0.35 * Math.sin( ( x / ( len * 0.53 ) ) * Math.PI * 2 + phase * 1.7 );
			d += ` L${ x } ${ yy.toFixed( 2 ) }`;
		}
		return d + ` L${ w + step } ${ bottom } Z`;
	}
	/** Preloads CSS background images (img tags are awaited automatically). */
	const preload = ( urls ) => Promise.all( urls.map( ( u ) => new Promise( ( ok ) => {
		const i = new Image();
		i.onload = i.onerror = () => ok();
		i.src = u;
	} ) ) );

	// The surfer's own cursor glyphs (src/styles/theme/_icons.scss), ink #1a1a18 on white.
	const CURSOR = {
		arrow: `<svg viewBox="0 0 24 24" width="100%" height="100%"><path d="M4 2 L4 20 L9 16 L12 22 L15 20.5 L12 14.5 L18 14.5 Z" fill="#1a1a18" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/></svg>`,
		caret: `<svg viewBox="0 0 24 24" width="100%" height="100%"><g stroke="#fff" stroke-width="5" stroke-linecap="round" fill="none"><path d="M8.5 3.5c2 0 3.5 0.8 3.5 2v13c0 1.2 1.5 2 3.5 2M15.5 3.5c-2 0-3.5 0.8-3.5 2v13c0 1.2-1.5 2-3.5 2"/></g><g stroke="#1a1a18" stroke-width="2.2" stroke-linecap="round" fill="none"><path d="M8.5 3.5c2 0 3.5 0.8 3.5 2v13c0 1.2 1.5 2 3.5 2M15.5 3.5c-2 0-3.5 0.8-3.5 2v13c0 1.2-1.5 2-3.5 2"/></g></svg>`,
	};
	/** Makes a cursor element; place it with tf(el, {x, y, s}). The arrow's hot spot is (4,2) of 24. */
	function cursor( parent, kind = 'arrow', size = 34 ) {
		const el = document.createElement( 'div' );
		el.className = 'cursor';
		el.style.width = el.style.height = `${ size }px`;
		el.innerHTML = CURSOR[ kind ];
		parent.appendChild( el );
		return el;
	}
	/** Product click ripple: a teal ring expanding over 0.4 s. Returns an updater(tSinceClick). */
	function ripple( parent ) {
		const el = document.createElement( 'div' );
		el.className = 'ripple';
		el.style.opacity = '0';
		parent.appendChild( el );
		return ( x, y, dt, scale = 1 ) => {
			if ( dt < 0 || dt > 0.45 ) {
				el.style.opacity = '0';
				return;
			}
			const p = E.outCubic( dt / 0.45 );
			const d = ( 12 + 46 * p ) * scale;
			el.style.width = el.style.height = `${ d }px`;
			el.style.transform = `translate(${ x - d / 2 }px, ${ y - d / 2 }px)`;
			el.style.opacity = String( 1 - p );
		};
	}
	/** Registers the scene and flags readiness once fonts and images are in. */
	function scene( def ) {
		window.SCENE = def;
		const imgs = [ ...document.images ];
		Promise.all( [
			document.fonts.ready,
			preload( def.assets || [] ),
			...imgs.map( ( i ) => ( i.complete ? Promise.resolve() : new Promise( ( ok ) => { i.onload = i.onerror = ok; } ) ).then( () => i.decode().catch( () => {} ) ) ),
		] ).then( async () => {
			if ( def.setup ) await def.setup();
			def.render( 0 );
			window.SCENE_READY = true;
		} );
	}
	window.S = { clamp, lerp, E, prog, kf, $, $$, tf, rng, wavePath, preload, cursor, ripple, scene, CURSOR };
} )();
