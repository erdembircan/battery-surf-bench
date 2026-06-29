import { describe, it, expect, afterEach } from 'vitest';
import { pageTypeFor, findTargets } from './PageModel';

describe( 'pageTypeFor', () => {
	it( 'maps slugs to page types', () => {
		expect( pageTypeFor( 'article-1' ) ).toBe( 'article' );
		expect( pageTypeFor( 'article-2' ) ).toBe( 'article' );
		expect( pageTypeFor( 'gallery' ) ).toBe( 'gallery' );
		expect( pageTypeFor( 'video' ) ).toBe( 'video' );
		expect( pageTypeFor( 'links' ) ).toBe( 'links' );
	} );

	it( 'falls back to article for an unknown slug', () => {
		expect( pageTypeFor( 'nonsense' ) ).toBe( 'article' );
		expect( pageTypeFor( '' ) ).toBe( 'article' );
	} );
} );

describe( 'findTargets', () => {
	afterEach( () => {
		document.body.innerHTML = '';
	} );

	it( 'finds reading, figure and video targets inside the course content', () => {
		document.body.innerHTML = `
			<div class="bsb-course-content">
				<h1>Title</h1>
				<p>One</p>
				<p>Two</p>
				<figure><svg></svg></figure>
				<div class="bsb-video__ratio">
					<iframe id="bsb-yt" src="https://example.test/embed"></iframe>
				</div>
			</div>`;

		const targets = findTargets( document, 'video' );
		expect( targets.type ).toBe( 'video' );
		expect( targets.text ).toHaveLength( 3 ); // h1 + 2 p
		expect( targets.figures ).toHaveLength( 1 );
		expect( targets.video ).not.toBeNull();
		expect( targets.video?.id ).toBe( 'bsb-yt' );
	} );

	it( 'returns no video when the page has none', () => {
		document.body.innerHTML =
			'<div class="bsb-course-content"><p>Read me</p></div>';

		const targets = findTargets( document, 'article-1' );
		expect( targets.type ).toBe( 'article' );
		expect( targets.video ).toBeNull();
		expect( targets.text ).toHaveLength( 1 );
	} );
} );
