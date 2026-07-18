import { describe, it, expect, vi } from 'vitest';
import {
	postSteerBehavior,
	STEER_BEHAVIOR_TYPE,
} from '@/cockpit/SteerBehavior';

describe( 'postSteerBehavior', () => {
	it( 'posts the steer command to the target window with the given origin', () => {
		const postMessage = vi.fn();
		const target = { postMessage } as unknown as Window;

		postSteerBehavior( target, 'https://example.test', 'readPause' );

		expect( postMessage ).toHaveBeenCalledWith(
			{ type: STEER_BEHAVIOR_TYPE, key: 'readPause' },
			'https://example.test'
		);
	} );

	it( 'is a no-op when the target is null', () => {
		expect( () =>
			postSteerBehavior( null, 'https://example.test', 'readPause' )
		).not.toThrow();
	} );
} );
