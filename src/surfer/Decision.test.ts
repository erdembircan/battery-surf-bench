import { describe, it, expect } from 'vitest';
import {
	scoreActions,
	selectAction,
	type SurfContext,
	type ScoredAction,
} from './Decision';

// [haste, endurance, reach, literacy, recall, allure]
const ctx = ( over: Partial< SurfContext > = {} ): SurfContext => ( {
	traits: [ 5, 5, 5, 5, 5, 5 ],
	pageType: 'article',
	atTop: true,
	atTarget: false,
	atBottom: false,
	watched: false,
	...over,
} );

const score = ( actions: ScoredAction[], kind: string ): number =>
	actions.find( ( a ) => a.kind === kind )?.score ?? 0;

const has = ( actions: ScoredAction[], kind: string ): boolean =>
	actions.some( ( a ) => a.kind === kind );

describe( 'scoreActions — availability gating (context gates, never decides)', () => {
	it( 'offers advance until the bottom, but tapers it past the reading depth', () => {
		expect( has( scoreActions( ctx() ), 'advance' ) ).toBe( true );
		// Still offered past the target depth — just weaker, so the surfer lingers.
		const atTarget = scoreActions( ctx( { atTarget: true } ) );
		expect( has( atTarget, 'advance' ) ).toBe( true );
		expect( score( atTarget, 'advance' ) ).toBeLessThan(
			score( scoreActions( ctx() ), 'advance' )
		);
		// Gone only at the bottom — no scroll-down possible there.
		expect(
			has( scoreActions( ctx( { atBottom: true } ) ), 'advance' )
		).toBe( false );
	} );

	it( 'offers regress only away from the top', () => {
		expect( has( scoreActions( ctx( { atTop: true } ) ), 'regress' ) ).toBe(
			false
		);
		expect(
			has( scoreActions( ctx( { atTop: false } ) ), 'regress' )
		).toBe( true );
	} );

	it( 'never scores dwell — it is only the fallback when nothing is available', () => {
		expect( has( scoreActions( ctx() ), 'dwell' ) ).toBe( false );
		// Bottom with no Recall: nothing scores, so the surfer absorbs the end.
		const dead = scoreActions(
			ctx( {
				atBottom: true,
				atTop: false,
				traits: [ 5, 5, 5, 5, 0, 5 ],
			} )
		);
		expect( dead ).toHaveLength( 0 );
		expect( selectAction( dead ) ).toBe( 'dwell' );
	} );
} );

describe( 'scoreActions — the trait drives the action, page-position does not', () => {
	it( 're-read (regress) is driven by Recall and offered the whole page', () => {
		const lowRecall = scoreActions(
			ctx( { atTop: false, traits: [ 5, 5, 5, 5, 0, 5 ] } )
		);
		const highRecall = scoreActions(
			ctx( { atTop: false, traits: [ 5, 5, 5, 5, 10, 5 ] } )
		);
		expect( score( highRecall, 'regress' ) ).toBeGreaterThan(
			score( lowRecall, 'regress' )
		);
		// Available mid-page, not only at the bottom.
		expect( has( highRecall, 'regress' ) ).toBe( true );
	} );

	it( 'skim-drive (advance) is stronger for low Literacy / high Haste', () => {
		const skimmer = score(
			scoreActions( ctx( { traits: [ 10, 5, 5, 0, 5, 5 ] } ) ),
			'advance'
		);
		const reader = score(
			scoreActions( ctx( { traits: [ 0, 5, 5, 10, 5, 5 ] } ) ),
			'advance'
		);
		expect( skimmer ).toBeGreaterThan( reader );
	} );

	it( 'video offers watch (Allure), and replay only once watched', () => {
		const fresh = scoreActions(
			ctx( { pageType: 'video', watched: false } )
		);
		expect( has( fresh, 'watch' ) ).toBe( true );
		expect( has( fresh, 'replay' ) ).toBe( false );

		const seen = scoreActions(
			ctx( {
				pageType: 'video',
				watched: true,
				traits: [ 5, 5, 5, 5, 5, 10 ],
			} )
		);
		expect( has( seen, 'replay' ) ).toBe( true );
	} );
} );

describe( 'selectAction — weighted-random over scores', () => {
	const scored: ScoredAction[] = [
		{ kind: 'advance', score: 1 },
		{ kind: 'regress', score: 3 },
	];

	it( 'picks proportionally to score by the RNG draw', () => {
		// total 4: draw 0.1 → 0.4 lands in advance's [0,1) band.
		expect( selectAction( scored, () => 0.1 ) ).toBe( 'advance' );
		// draw 0.5 → 2.0 lands past advance, in regress.
		expect( selectAction( scored, () => 0.5 ) ).toBe( 'regress' );
	} );

	it( 'falls back to dwell when nothing is available', () => {
		expect( selectAction( [] ) ).toBe( 'dwell' );
	} );
} );
