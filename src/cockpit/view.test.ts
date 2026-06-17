/**
 * Tests for the cockpit Interactivity store.
 *
 * The store's consumer is the block markup: the viewport iframe binds its `src`
 * to `state.currentSrc`. These tests stub the Interactivity runtime, capture
 * the store definition the module registers, and assert the URL that getter
 * derives from the per-instance context.
 */

import { vi, describe, it, expect } from 'vitest';

interface CoursePage {
	slug: string;
	title: string;
	url: string;
}

const mocks = vi.hoisted( () => ( {
	config: undefined as { state: { currentSrc: string } } | undefined,
	context: { pages: [] as CoursePage[], activeIndex: 0 },
} ) );

vi.mock( '@wordpress/interactivity', () => ( {
	store: (
		_namespace: string,
		config: { state: { currentSrc: string } }
	) => {
		mocks.config = config;
		return config;
	},
	getContext: () => mocks.context,
} ) );

import './view';

describe( 'bsb/cockpit view store', () => {
	it( 'derives the viewport src from the active course page', () => {
		mocks.context = {
			pages: [
				{
					slug: 'article-1',
					title: 'T',
					url: 'https://example.test/article-1',
				},
			],
			activeIndex: 0,
		};

		expect( mocks.config?.state.currentSrc ).toBe(
			'https://example.test/article-1'
		);
	} );

	it( 'yields an empty src when there are no pages to surf', () => {
		mocks.context = { pages: [], activeIndex: 0 };

		expect( mocks.config?.state.currentSrc ).toBe( '' );
	} );
} );
