/**
 * Tests for the cockpit Interactivity store.
 *
 * The store's consumer is the block markup: the viewport iframe binds its `src`
 * to `state.currentSrc`, a label binds to `state.currentLabel`, and the cycle
 * button calls `actions.next`. These tests stub the Interactivity runtime,
 * capture the store definition the module registers, and assert what those
 * derive from (and do to) the per-instance context.
 */

import { vi, describe, it, expect } from 'vitest';

interface CoursePage {
	slug: string;
	title: string;
	url: string;
}

interface CockpitConfig {
	state: { currentSrc: string; currentLabel: string };
	actions: { next: () => void };
}

const mocks = vi.hoisted( () => ( {
	config: undefined as CockpitConfig | undefined,
	context: { pages: [] as CoursePage[], activeIndex: 0 },
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: ( _namespace: string, config: CockpitConfig ) => {
		mocks.config = config;
		return config;
	},
	getContext: () => mocks.context,
} ) );

import './view';

const page = ( n: string ): CoursePage => ( {
	slug: n,
	title: n.toUpperCase(),
	url: `https://example.test/${ n }`,
} );

describe( 'bsb/cockpit view store', () => {
	it( 'derives the viewport src from the active course page', () => {
		mocks.context = { pages: [ page( 'article-1' ) ], activeIndex: 0 };

		expect( mocks.config?.state.currentSrc ).toBe(
			'https://example.test/article-1'
		);
	} );

	it( 'yields an empty src when there are no pages to surf', () => {
		mocks.context = { pages: [], activeIndex: 0 };

		expect( mocks.config?.state.currentSrc ).toBe( '' );
	} );

	it( 'labels the active page with its position and title', () => {
		mocks.context = {
			pages: [ page( 'article-1' ), page( 'gallery' ) ],
			activeIndex: 1,
		};

		expect( mocks.config?.state.currentLabel ).toBe( '2/2 — GALLERY' );
	} );

	it( 'cycles to the next page and wraps around', () => {
		mocks.context = {
			pages: [ page( 'article-1' ), page( 'gallery' ) ],
			activeIndex: 0,
		};

		mocks.config?.actions.next();
		expect( mocks.context.activeIndex ).toBe( 1 );
		expect( mocks.config?.state.currentSrc ).toBe(
			'https://example.test/gallery'
		);

		mocks.config?.actions.next();
		expect( mocks.context.activeIndex ).toBe( 0 );
	} );
} );
