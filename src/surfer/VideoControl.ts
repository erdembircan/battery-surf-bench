/**
 * Starts, stops, replays and reads the playback state of the page's video or
 * video-host embed. `DomMotor.playVideo` builds one of these for whatever
 * element it attends and keeps it so later verbs (`replayVideo`, `stopVideo`,
 * `videoState`) act on the exact same thing — `WatchVideo.run` drives a
 * player-state-aware watch: start, dwell in slices watching for the player
 * to report `'ended'` (replaying when it does, so a video shorter than the
 * watch window gets rewatched rather than leaving the surfer parked next to
 * a finished player), then a full stop once the window elapses.
 *
 * A real `<video>` is driven — and its state read — through its own element
 * API. A YouTube (or youtube-nocookie) embed is driven through the IFrame
 * API's raw `postMessage` command protocol — no `iframe_api` remote script
 * is loaded — and reads state the same way: it registers as a
 * `{event:'listening'}` listener and consumes the player's own event
 * messages. This was verified against a real, live embed (see
 * `docs/plans/native-youtube-embed-playback-plan.md`): posting
 * `{event:'listening'}` (no `id` field — a real embed echoes back any `id`
 * it's given but never requires or validates one) immediately triggers an
 * `initialDelivery` (plus `onReady`) carrying the current `info.playerState`,
 * and every subsequent state change arrives as `infoDelivery` with
 * `info.playerState` (the documented `onStateChange` shape —
 * `{event:'onStateChange', info:<code>}`
 * — is handled too, for parity with the published API, even though the live
 * embed observed here reports exclusively via `infoDelivery`). A real watch
 * cycle was also confirmed end to end against a short (19s) real video:
 * `playVideo` → `unstarted(-1)` → `buffering(3)` → `playing(1)` → naturally
 * `ended(0)`; from `ended`, `seekTo(0, true)` + `playVideo` genuinely
 * restarts playback (`playing` at `currentTime` 0 again); `stopVideo`
 * genuinely resets the player away from `ended` (observed transitioning to
 * `unstarted`/`cued`), so a later fresh `play()` never mistakes a
 * deliberately-stopped player for one that merely finished.
 *
 * Anything else (a Vimeo embed, or a YouTube iframe whose `src` doesn't
 * resolve to a parseable origin) is a safe no-op in every direction and
 * reports `'unavailable'`, so a page with an embed this module doesn't know
 * how to drive behaves exactly as it did before: attended, dwelled the full
 * watch window, never actually started, stopped, replayed or queried.
 */

/** The player's own reported playback state. `'unavailable'` covers anything this module can't read state from at all (Vimeo, a detached target). */
export type VideoPlaybackState =
	| 'unavailable'
	| 'unstarted'
	| 'playing'
	| 'paused'
	| 'ended'
	| 'buffering'
	| 'cued';

/** A motion primitive that starts, stops, replays and reads the state of whatever element it was built for. */
export interface VideoControl {
	/** Starts (or resumes) playback; replays from the start when the player has ended; a no-op when already playing. Never throws. */
	play: () => Promise< void >;
	/** Fully stops playback (not merely paused), so a later `play()` starts clean. Never throws. */
	stop: () => Promise< void >;
	/** The player's current playback state, read from its own reported state. */
	getState: () => VideoPlaybackState;
	/** Releases any resources this control holds (e.g. a `message` listener). Idempotent, never throws. */
	dispose: () => void;
}

/** A YouTube IFrame API command, as the raw `postMessage` protocol expects it. */
type YouTubeCommand = 'playVideo' | 'stopVideo' | 'seekTo';

/**
 * Hosts whose embed iframe accepts the YouTube IFrame API's postMessage
 * command protocol.
 */
const YOUTUBE_HOST_PATTERN = /(?:^|\.)youtube(?:-nocookie)?\.com$/;

/**
 * Serializes a YouTube IFrame API command the way its raw `postMessage`
 * protocol expects — `{event: 'command', func, args}` — rather than loading
 * the `iframe_api` remote script just to get a typed wrapper around the same
 * message. No `id` field: a real embed accepts commands without one (and
 * only ever echoes back whatever `id` a message carries — it never
 * validates it), confirmed by driving a real embed.
 * @param func
 * @param args
 */
const youtubeCommand = (
	func: YouTubeCommand,
	args: readonly unknown[] = []
): string => JSON.stringify( { event: 'command', func, args } );

/** The message that opts this frame in to the player's state-change event stream — confirmed against a real embed (see the module doc comment). */
const YOUTUBE_LISTENING_MESSAGE = JSON.stringify( { event: 'listening' } );

/** Maps the YouTube IFrame API's numeric player state to {@link VideoPlaybackState}, confirmed against a real embed. */
const YOUTUBE_STATE_BY_CODE: Readonly< Record< number, VideoPlaybackState > > =
	{
		[ -1 ]: 'unstarted',
		0: 'ended',
		1: 'playing',
		2: 'paused',
		3: 'buffering',
		5: 'cued',
	};

/**
 * The origin a YouTube (or youtube-nocookie) embed's `src` resolves to, for
 * use as `postMessage`'s required `targetOrigin` — or null when `src` isn't
 * a parseable URL on a recognized YouTube host (a malformed `src`, or an
 * embed this module doesn't drive at all).
 * @param src
 */
export const youtubeTargetOrigin = ( src: string ): string | null => {
	try {
		const url = new URL( src );
		return YOUTUBE_HOST_PATTERN.test( url.hostname ) ? url.origin : null;
	} catch {
		return null;
	}
};

/**
 * Narrows to a plain object, so a player-state message's shape can be read without risking a property access on `null`/a primitive.
 * @param value
 */
const isRecord = ( value: unknown ): value is Record< string, unknown > =>
	'object' === typeof value && null !== value;

/**
 * Reads the numeric player-state code out of either message shape the real
 * embed sends: `{event:'onStateChange', info:<code>}` (the documented API)
 * or `{event:'infoDelivery', info:{playerState:<code>}}` (what the live
 * embed observed here actually sends on every state change). Null when
 * `message` is neither.
 * @param message
 */
const extractPlayerStateCode = (
	message: Record< string, unknown >
): number | null => {
	if (
		'onStateChange' === message.event &&
		'number' === typeof message.info
	) {
		return message.info;
	}

	if (
		'infoDelivery' === message.event &&
		isRecord( message.info ) &&
		'number' === typeof message.info.playerState
	) {
		return message.info.playerState;
	}

	return null;
};

/** Does nothing, successfully, and reports no state — the fallback for anything this module doesn't know how to drive. */
const NOOP_CONTROL: VideoControl = {
	play: () => Promise.resolve(),
	stop: () => Promise.resolve(),
	getState: () => 'unavailable',
	dispose: () => undefined,
};

/**
 * Drives a real `<video>` element through its own element API, reading state
 * directly off the element. `play()` preserves the existing muted-retry
 * fallback: unmuted autoplay without a user gesture is commonly blocked, so
 * a rejected `play()` retries muted (which browsers allow) rather than
 * leaving the element paused. `play()` replays from `0` when the element has
 * already ended, and is a no-op when already playing. `stop()` is a genuine
 * full stop: paused AND reset to `0`, so a later `play()` starts clean
 * rather than resuming mid-way.
 * @param el
 */
const videoElementControl = ( el: HTMLVideoElement ): VideoControl => ( {
	play: async () => {
		if ( ! el.paused && ! el.ended ) {
			return;
		}

		if ( el.ended ) {
			el.currentTime = 0;
		}

		try {
			await el.play();
		} catch {
			el.muted = true;
			await el.play().catch( () => undefined );
		}
	},
	stop: async () => {
		el.pause();
		el.currentTime = 0;
	},
	getState: (): VideoPlaybackState => {
		if ( el.ended ) {
			return 'ended';
		}

		if ( ! el.paused ) {
			return 'playing';
		}

		return el.currentTime > 0 ? 'paused' : 'unstarted';
	},
	dispose: () => undefined,
} );

/**
 * Drives a YouTube/youtube-nocookie embed iframe by posting raw IFrame API
 * commands to its `contentWindow`, and reads its state by listening for the
 * player's own event messages on `window` — both confirmed against a real
 * embed (see the module doc comment). Guards a missing `contentWindow` (e.g.
 * the iframe was detached) rather than throwing.
 * @param el
 * @param targetOrigin
 */
const youtubeIframeControl = (
	el: HTMLIFrameElement,
	targetOrigin: string
): VideoControl => {
	let state: VideoPlaybackState = 'unstarted';
	let hasPlayedOnce = false;

	const post = ( func: YouTubeCommand, args: readonly unknown[] = [] ) => {
		el.contentWindow?.postMessage(
			youtubeCommand( func, args ),
			targetOrigin
		);
	};

	const assertListening = () => {
		el.contentWindow?.postMessage(
			YOUTUBE_LISTENING_MESSAGE,
			targetOrigin
		);
	};

	const onMessage = ( event: MessageEvent ) => {
		if (
			event.source !== el.contentWindow ||
			event.origin !== targetOrigin
		) {
			return;
		}

		let parsed: unknown;

		try {
			parsed = JSON.parse( event.data );
		} catch {
			return;
		}

		if ( ! isRecord( parsed ) ) {
			return;
		}

		const code = extractPlayerStateCode( parsed );

		if ( null !== code && code in YOUTUBE_STATE_BY_CODE ) {
			state = YOUTUBE_STATE_BY_CODE[ code ];
		}
	};

	window.addEventListener( 'message', onMessage );
	assertListening();

	return {
		play: async () => {
			if ( 'playing' === state ) {
				return;
			}

			// Re-assert on first play as a defensive measure against the
			// initial handshake (posted at creation, above) racing the
			// embed's own message-bridge attaching — cheap, and confirmed
			// harmless to repeat against a real embed.
			if ( ! hasPlayedOnce ) {
				assertListening();
				hasPlayedOnce = true;
			}

			if ( 'ended' === state ) {
				post( 'seekTo', [ 0, true ] );
			}

			post( 'playVideo' );
		},
		stop: async () => {
			post( 'stopVideo' );
		},
		getState: () => state,
		dispose: () => {
			window.removeEventListener( 'message', onMessage );
		},
	};
};

/**
 * Builds the {@link VideoControl} for whatever element `DomMotor.playVideo`
 * attended: a real `<video>` element, a YouTube/youtube-nocookie embed
 * iframe, or — a Vimeo embed, or anything else — a safe no-op reporting
 * `'unavailable'` in every direction.
 * @param el
 */
export const createVideoControl = ( el: Element ): VideoControl => {
	if ( el instanceof HTMLVideoElement ) {
		return videoElementControl( el );
	}

	if ( el instanceof HTMLIFrameElement ) {
		const targetOrigin = youtubeTargetOrigin( el.src );

		if ( null !== targetOrigin ) {
			return youtubeIframeControl( el, targetOrigin );
		}
	}

	return NOOP_CONTROL;
};
