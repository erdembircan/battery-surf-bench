/* Cockpit composition helpers for the product-plate scenes (S01–02, S05–08,
   S12). Geometry in the cockpit's own CSS pixels (1920×1080): the compact top
   bar is 88 px tall and the surf viewport fills the rest. Plates are 2× PNGs,
   so the camera can push in to 2× and stay sharp. */
( function () {
	const TOPBAR = 88;
	const P = '../../plates/';

	function el( tag, cls, parent, style = '' ) {
		const e = document.createElement( tag );
		if ( cls ) e.className = cls;
		e.style.cssText = style;
		parent.appendChild( e );
		return e;
	}
	/** A full-size 2× image shown at 1× CSS size. */
	function plateImg( parent, file, w = 1920, h = 1080, style = '' ) {
		const i = el( 'img', '', parent, `position:absolute;left:0;top:0;width:${ w }px;height:${ h }px;${ style }` );
		i.src = P + file;
		return i;
	}

	/**
	 * Builds a cockpit "screen" (1920×1080) inside `parent`.
	 * opts.plate: full cockpit plate (topbar + chrome); opts.page: course texture
	 * shown in the viewport (scrollable); opts.topbarB: second plate whose top bar
	 * can be cross-faded in (the 1 % tick).
	 */
	function screen( parent, opts = {} ) {
		const root = el( 'div', '', parent, 'position:absolute;left:0;top:0;width:1920px;height:1080px;transform-origin:0 0;background:#fff;overflow:hidden' );
		const api = { root };
		if ( opts.plate ) api.plate = plateImg( root, opts.plate );
		if ( opts.page ) {
			const vp = el( 'div', '', root, `position:absolute;left:0;top:${ TOPBAR }px;width:1920px;height:${ 1080 - TOPBAR }px;overflow:hidden;background:#fff` );
			const tex = el( 'img', '', vp, 'position:absolute;left:0;top:0;width:1920px;transform-origin:0 0' );
			tex.src = P + opts.page;
			api.viewport = vp;
			api.page = tex;
			api.scroll = ( y ) => ( tex.style.transform = `translate3d(0, ${ -y }px, 0)` );
			api.scroll( opts.scroll ?? 0 );
		}
		if ( opts.topbarB ) {
			const clip = el( 'div', '', root, `position:absolute;left:0;top:0;width:1920px;height:${ TOPBAR + 6 }px;overflow:hidden;opacity:0` );
			plateImg( clip, opts.topbarB );
			api.topbarB = clip;
		}
		// Overlay layer (barks, cursor, ripples) above the viewport.
		api.over = el( 'div', '', root, 'position:absolute;left:0;top:0;width:1920px;height:1080px' );
		return api;
	}

	/** The product's bark pill sprite (bark-<key>.png, 2× with 44/22 px padding). */
	function bark( parent, key ) {
		const i = el( 'img', '', parent, 'position:absolute;left:0;top:0;opacity:0;transform-origin:50% 40%' );
		i.src = `${ P }bark-${ key }.png`;
		return ( p ) => {
			// The plugin's bsb-bark-in: 460 ms, cubic-bezier(0.16, 1, 0.3, 1).
			const w = i.naturalWidth / 2;
			const h = i.naturalHeight / 2;
			i.style.width = `${ w }px`;
			i.style.height = `${ h }px`;
			const e = S.E.outQuint( S.clamp( p ) );
			const x = 960 - w / 2;
			const y = TOPBAR + 14.4 - 22 + ( 1 - e ) * -10;
			i.style.transform = `translate3d(${ x }px, ${ y }px, 0) scale(${ 0.94 + 0.06 * e })`;
			i.style.opacity = String( S.clamp( p * 1.6 ) );
		};
	}

	/** Places a screen so cockpit point (cx, cy) sits at stage point (sx, sy) at zoom z. */
	function camera( api, { cx, cy, z, sx = 960, sy = 540 } ) {
		api.root.style.transform = `translate3d(${ sx - cx * z }px, ${ sy - cy * z }px, 0) scale(${ z })`;
	}

	/** Sun-yellow marker-swipe super (montage words). Returns an updater(p). */
	function swipeWord( parent, text, { x = 110, y = 820, size = 150 } = {} ) {
		const wrap = el( 'div', '', parent, `position:absolute;left:${ x }px;top:${ y }px;transform-origin:0 100%` );
		const card = el( 'div', '', wrap, `position:absolute;left:${ -size * 0.3 }px;top:${ -size * 0.16 }px;right:${ -size * 0.34 }px;bottom:${ -size * 0.12 }px;background:rgba(255,255,255,0.97);border-radius:${ size * 0.2 }px;box-shadow:0 26px 60px -24px rgba(31,58,95,0.55),0 0 0 ${ size * 0.06 }px rgba(47,155,179,0.12);opacity:0` );
		const swash = el( 'div', '', wrap, `position:absolute;left:-26px;right:-30px;top:${ size * 0.36 }px;height:${ size * 0.58 }px;background:var(--sun);border-radius:${ size * 0.12 }px ${ size * 0.3 }px ${ size * 0.18 }px ${ size * 0.1 }px;transform-origin:0 50%;transform:skewX(-8deg) scaleX(0)` );
		const word = el( 'div', 'super', wrap, `position:relative;font-size:${ size }px;opacity:0` );
		word.textContent = text;
		return ( p ) => {
			const c = S.clamp( p / 0.4 );
			card.style.opacity = String( S.E.outCubic( c ) );
			wrap.style.transform = `scale(${ 0.86 + 0.14 * S.E.outBack( c, 1.6 ) })`;
			const a = S.E.outCubic( S.clamp( p / 0.55 ) );
			swash.style.transform = `skewX(-8deg) scaleX(${ a })`;
			const b = S.clamp( ( p - 0.18 ) / 0.6 );
			word.style.opacity = String( S.clamp( b * 2 ) );
			word.style.transform = `translate3d(0, ${ ( 1 - S.E.outBack( b, 1.4 ) ) * 36 }px, 0)`;
		};
	}

	window.Cockpit = { TOPBAR, screen, bark, camera, plateImg, swipeWord, el };
} )();
