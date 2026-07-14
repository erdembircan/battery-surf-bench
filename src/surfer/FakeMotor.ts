import type { Motor } from './Motor';
import type { VideoPlaybackState } from './VideoControl';

/** One motion command a {@link FakeMotor} recorded. */
export interface RecordedCommand {
	kind:
		| 'scrollBy'
		| 'pointerDrift'
		| 'selectSnippet'
		| 'playVideo'
		| 'replayVideo'
		| 'stopVideo'
		| 'lingerImage'
		| 'readTrace'
		| 'idle';
	args: readonly number[];
}

/**
 * Test double for {@link Motor}: never touches the DOM, just records every
 * command it was asked to perform so a test can assert on the sequence and
 * arguments without a real browser.
 */
export class FakeMotor implements Motor {
	readonly commands: RecordedCommand[] = [];
	/**
	 * Values `videoState()` returns, consumed one per call in order; once
	 * exhausted, every further call returns `videoStateFallback`. Lets a
	 * test script exactly when (if ever) the "video" reports `'ended'`.
	 */
	videoStateSequence: VideoPlaybackState[] = [];
	/** Returned once `videoStateSequence` is exhausted (or on every call, if it was never set). Defaults to `'unavailable'` — no video. */
	videoStateFallback: VideoPlaybackState = 'unavailable';

	scrollBy( px: number, ms: number ): Promise< void > {
		this.commands.push( { kind: 'scrollBy', args: [ px, ms ] } );
		return Promise.resolve();
	}

	pointerDrift( ms: number ): Promise< void > {
		this.commands.push( { kind: 'pointerDrift', args: [ ms ] } );
		return Promise.resolve();
	}

	selectSnippet(): Promise< void > {
		this.commands.push( { kind: 'selectSnippet', args: [] } );
		return Promise.resolve();
	}

	playVideo(): Promise< void > {
		this.commands.push( { kind: 'playVideo', args: [] } );
		return Promise.resolve();
	}

	replayVideo(): Promise< void > {
		this.commands.push( { kind: 'replayVideo', args: [] } );
		return Promise.resolve();
	}

	videoState(): VideoPlaybackState {
		return this.videoStateSequence.length > 0
			? ( this.videoStateSequence.shift() as VideoPlaybackState )
			: this.videoStateFallback;
	}

	stopVideo(): Promise< void > {
		this.commands.push( { kind: 'stopVideo', args: [] } );
		return Promise.resolve();
	}

	lingerImage( ms: number ): Promise< void > {
		this.commands.push( { kind: 'lingerImage', args: [ ms ] } );
		return Promise.resolve();
	}

	readTrace( ms: number ): Promise< void > {
		this.commands.push( { kind: 'readTrace', args: [ ms ] } );
		return Promise.resolve();
	}

	idle( ms: number ): Promise< void > {
		this.commands.push( { kind: 'idle', args: [ ms ] } );
		return Promise.resolve();
	}
}
