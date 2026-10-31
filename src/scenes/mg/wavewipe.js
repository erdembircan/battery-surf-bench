/* Wave wipe transition, shared so consecutive scenes join seamlessly.
   const wipe = buildWaveWipe( svgEl );
   wipe.update( p, 'in' )  — a wave rolls in from the left until it covers the frame (p: 0 → 1).
   wipe.update( p, 'out' ) — the covering wave rolls off to the right, revealing what's behind (p: 0 → 1).
   At 'in' p = 1 and 'out' p = 0 the frame is solid deep teal (#1c7e96), so an
   'in' that ends one scene and an 'out' that starts the next cut together cleanly.
   Pass an eased p (e.g. S.E.inOutCubic) and a running t for the edge's churn. */
window.buildWaveWipe = function ( svg ) {
	const NS = 'http://www.w3.org/2000/svg';
	svg.setAttribute( 'viewBox', '0 0 1920 1080' );
	svg.setAttribute( 'width', 1920 );
	svg.setAttribute( 'height', 1080 );
	// Back to front: the leading/trailing edge shows foam, then aqua, teal, deep body.
	const bands = [
		{ fill: '#ffffff', off: 0, amp: 30, len: 380, ph: 0.0 },
		{ fill: '#9ad9ea', off: 46, amp: 34, len: 430, ph: 1.3 },
		{ fill: '#2f9bb3', off: 150, amp: 40, len: 470, ph: 2.4 },
		{ fill: '#1c7e96', off: 280, amp: 46, len: 520, ph: 3.6 },
	].map( ( b ) => {
		const el = document.createElementNS( NS, 'path' );
		el.setAttribute( 'fill', b.fill );
		svg.appendChild( el );
		return { ...b, el };
	} );
	const SPAN = 1920 + 2 * 420; // edge travel so the body fully clears / fully covers
	function edgeX( base, b, y, t ) {
		const lean = 70 * Math.pow( 1 - y / 1080, 2 ); // crest leans forward at the top
		return base + b.amp * Math.sin( ( y / b.len ) * Math.PI * 2 + b.ph + t * 5 ) + 0.4 * b.amp * Math.sin( ( y / ( b.len * 0.37 ) ) * Math.PI * 2 - t * 7 ) + lean;
	}
	function update( p, mode = 'out', t = 0 ) {
		svg.style.display = ( mode === 'out' && p >= 1 ) || ( mode === 'in' && p <= 0 ) ? 'none' : '';
		for ( const b of bands ) {
			let d;
			if ( mode === 'in' ) {
				// Body to the left of the leading edge.
				const lead = -420 + p * SPAN - b.off;
				d = `M-400 -40 L${ edgeX( lead, b, -40, t ).toFixed( 1 ) } -40`;
				for ( let y = -40; y <= 1120; y += 20 ) d += ` L${ edgeX( lead, b, y, t ).toFixed( 1 ) } ${ y }`;
				d += ' L-400 1120 Z';
			} else {
				// Body to the right of the trailing edge.
				const trail = -420 + p * SPAN + b.off;
				d = `M2400 -40 L${ edgeX( trail, b, -40, t ).toFixed( 1 ) } -40`;
				for ( let y = -40; y <= 1120; y += 20 ) d += ` L${ edgeX( trail, b, y, t ).toFixed( 1 ) } ${ y }`;
				d += ' L2400 1120 Z';
			}
			b.el.setAttribute( 'd', d );
		}
		// 'in' draws foam first so deeper bands sit on top toward the body; 'out' the same.
	}
	return { update };
};
