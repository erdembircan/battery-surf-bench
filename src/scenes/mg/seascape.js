/* The WordPress.org banner's dawn seascape (docs/images/wordpress-org/banner.svg),
   recomposed for 1920×1080 and animated as a pure function of t.
   const sea = buildSeascape( svgEl, { horizon, sunX, sunR, glowR, seed } );
   sea.update( t, { sunLift, seaRise } ); */
window.buildSeascape = function ( svg, opts = {} ) {
	const NS = 'http://www.w3.org/2000/svg';
	const o = Object.assign( { horizon: 800, sunX: 960, sunR: 300, glowR: 560, seed: 7, sparkles: 260, swell: true }, opts );
	const id = 'sea' + Math.round( Math.random() * 1e6 );
	const mk = ( tag, attrs, parent = svg ) => {
		const el = document.createElementNS( NS, tag );
		for ( const k in attrs ) el.setAttribute( k, attrs[ k ] );
		parent.appendChild( el );
		return el;
	};
	svg.setAttribute( 'viewBox', '0 0 1920 1080' );
	svg.setAttribute( 'width', 1920 );
	svg.setAttribute( 'height', 1080 );
	const defs = mk( 'defs', {} );
	defs.innerHTML = `
		<linearGradient id="${ id }sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e7f6ff"/><stop offset="0.58" stop-color="#fdf2da"/><stop offset="1" stop-color="#ffd9a6"/></linearGradient>
		<radialGradient id="${ id }glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0.5" stop-color="#ffe6a6" stop-opacity="0.85"/><stop offset="1" stop-color="#ffe6a6" stop-opacity="0"/></radialGradient>
		<linearGradient id="${ id }sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#ffce5c"/></linearGradient>
		<linearGradient id="${ id }deep" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a9e0ef"/><stop offset="1" stop-color="#1c7e96"/></linearGradient>
		<radialGradient id="${ id }sheen" cx="0.5" cy="0" r="1"><stop offset="0" stop-color="#ffe9a8" stop-opacity="0.8"/><stop offset="0.4" stop-color="#ffe9a8" stop-opacity="0.34"/><stop offset="1" stop-color="#ffe9a8" stop-opacity="0"/></radialGradient>
		<clipPath id="${ id }above"><rect id="${ id }aboveRect" x="0" y="0" width="1920" height="${ o.horizon }"/></clipPath>`;
	const sky = mk( 'rect', { x: 0, y: 0, width: 1920, height: 1080, fill: `url(#${ id }sky)` } );
	// Below the horizon the sky only shows while the sea is still swelling up; keep it warm.
	mk( 'rect', { x: 0, y: o.horizon, width: 1920, height: 1080 - o.horizon, fill: '#ffd9a6' } );
	const above = mk( 'g', { 'clip-path': `url(#${ id }above)` } );
	const glow = mk( 'circle', { cx: o.sunX, cy: o.horizon, r: o.glowR, fill: `url(#${ id }glow)` }, above );
	const sun = mk( 'circle', { cx: o.sunX, cy: o.horizon, r: o.sunR, fill: `url(#${ id }sun)` }, above );
	const seaG = mk( 'g', {} );
	const sea = mk( 'rect', { x: 0, y: o.horizon, width: 1920, height: 1080 - o.horizon + 400, fill: `url(#${ id }deep)` }, seaG );
	const sheen = mk( 'ellipse', { cx: o.sunX, cy: o.horizon, rx: o.sunR * 1.45, ry: ( 1080 - o.horizon ) * 1.05, fill: `url(#${ id }sheen)` }, seaG );
	const line = mk( 'ellipse', { cx: o.sunX, cy: o.horizon + 1, rx: o.sunR * 0.95, ry: 3.5, fill: '#fff8de', opacity: 0.95 }, seaG );

	// Foam sparkles: thin lenses, bigger and sparser toward the viewer; golden in the sun's path.
	const r = S.rng( o.seed );
	const sparks = [];
	const depth = 1080 - o.horizon;
	for ( let i = 0; i < o.sparkles; i++ ) {
		const d = Math.pow( r(), 1.6 ); // 0 = horizon, 1 = foreground
		const y = o.horizon + 4 + d * ( depth - 10 );
		const w = 8 + d * 70 + r() * 18 * ( 0.3 + d );
		const h = 0.6 + d * 2.6;
		const inPath = r() < 0.38;
		const x = inPath ? o.sunX + ( r() - 0.5 ) * ( o.sunR * 0.5 + d * o.sunR * 1.6 ) : r() * 2100 - 90;
		const el = mk( 'path', { d: `M0 0Q${ w / 2 } ${ -h } ${ w } 0Q${ w / 2 } ${ h } 0 0Z`, fill: inPath ? '#fff6d8' : '#ffffff' }, seaG );
		sparks.push( { el, x, y, w, base: inPath ? 0.55 + r() * 0.4 : 0.22 + r() * 0.35, ph: r() * Math.PI * 2, om: 1.6 + r() * 3.2, drift: ( inPath ? 3 : 10 ) * ( 0.4 + d ), inPath } );
	}
	// Gentle swell crests in the foreground.
	const swells = [];
	if ( o.swell ) {
		for ( let k = 0; k < 3; k++ ) {
			swells.push( { el: mk( 'path', { fill: 'none', stroke: '#ffffff', 'stroke-width': 2 + k, 'stroke-linecap': 'round', opacity: 0.16 + k * 0.05 }, seaG ), y: o.horizon + depth * ( 0.42 + k * 0.2 ), amp: 5 + k * 4, len: 520 - k * 60, sp: 0.5 + k * 0.25 } );
		}
	}
	function update( t, { sunLift = 0, seaRise = 0 } = {} ) {
		const sy = o.horizon + sunLift;
		sun.setAttribute( 'cy', sy );
		glow.setAttribute( 'cy', sy );
		glow.setAttribute( 'r', o.glowR * ( 1 + 0.012 * Math.sin( t * 1.7 ) ) );
		seaG.setAttribute( 'transform', `translate(0 ${ seaRise })` );
		for ( const s of sparks ) {
			const tw = 0.55 + 0.45 * Math.sin( t * s.om + s.ph );
			let x = s.x - s.drift * t;
			if ( ! s.inPath ) x = ( ( ( x + 90 ) % 2100 ) + 2100 ) % 2100 - 90;
			s.el.setAttribute( 'transform', `translate(${ x.toFixed( 1 ) } ${ s.y.toFixed( 1 ) })` );
			s.el.setAttribute( 'opacity', ( s.base * tw ).toFixed( 3 ) );
		}
		for ( const w of swells ) {
			let d = '';
			for ( let x = -20; x <= 1940; x += 24 ) {
				const yy = w.y + w.amp * Math.sin( ( x / w.len ) * Math.PI * 2 - t * w.sp * 2 );
				d += ( d ? ' L' : 'M' ) + x + ' ' + yy.toFixed( 1 );
			}
			w.el.setAttribute( 'd', d );
		}
	}
	return { update, sun, glow, sky, seaG, horizon: o.horizon };
};
