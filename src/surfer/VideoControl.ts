/**
 * Starts, stops and replays the page's video or video-host embed, and lets a
 * caller subscribe to the moment it ends. `DomMotor.playVideo` builds one of
 * these for whatever element it attends and keeps it so later verbs
 * (`stopVideo`) act on the exact same thing; it also subscribes `onEnded` to
 * an automatic replay for as long as the control is active, so
 * `WatchVideo.run` stays a plain start → dwell → stop sequence while the
 * player itself drives any mid-window rewatch — no polling, no timer slices.
 *
 * A real `<video>` is driven through its own element API and its native
 * `'ended'` event. A YouTube (or youtube-nocookie) embed is driven through
 * the IFrame API's raw `postMessage` command protocol — no `iframe_api`
 * remote script is loaded — and is subscribed to the same way: it registers
 * as a `{event:'listening'}` listener and watches the player's own event
 * messages for the transition INTO `ended` (not every `ended` message —
 * `infoDelivery` repeats it — so `onEnded` fires exactly once per genuine
 * end, not once per heartbeat). This was verified against a real, live
 * embed while the feature was planned (plan retired with the merge, per
 * `docs/plans/` lifecycle; recoverable from git history): posting
 * `{event:'listening'}` (no `id` field — a real embed echoes back any `id`
 * it's given but never requires or validates one) immediately triggers an
 * `initialDelivery` (plus `onReady`) carrying the current `info.playerState`,
 * and every subsequent state change arrives as `infoDelivery` with
 * `info.playerState` (the documented `onStateChange` shape —
 * `{event:'onStateChange', info:<code>}` — is handled too, for parity with
 * the published API, even though the live embed observed here reports
 * exclusively via `infoDelivery`). A real end-to-end cycle was also
 * confirmed against a short (19s) real video: `playVideo` →
 * `unstarted(-1)` → `buffering(3)` → `playing(1)` → naturally `ended(0)`,
 * firing the subscribed callback the instant that message arrived; from
 * `ended`, `seekTo(0, true)` + `playVideo` genuinely restarts playback
 * (`playing` at `currentTime` 0 again); `stopVideo` genuinely resets the
 * player away from `ended` (observed transitioning to `unstarted`/`cued`),
 * so a later fresh `play()` never mistakes a deliberately-stopped player for
 * one that merely finished. The same sequence was replayed on 2026-11-04
 * against embeds on both `www.youtube.com` and `www.youtube-nocookie.com`,
 * which answered message for message alike, before the plugin moved its
 * embeds to the privacy-enhanced host.
 *
 * Anything else (a Vimeo embed, or a YouTube iframe whose `src` doesn't
 * resolve to a parseable origin) is a safe no-op in every direction and
 * never calls an `onEnded` subscriber, so a page with an embed this module
 * doesn't know how to drive behaves exactly as it did before: attended,
 * dwelled the full watch window, never actually started, stopped or
 * replayed.
 */

/** A motion primitive that starts, stops and replays whatever element it was built for, and reports when it ends. */
export interface VideoControl {
	/** Starts (or resumes) playback; replays from the start when the player has ended; a no-op when already playing. Never throws. */
	play: () => Promise< void >;
	/** Fully stops playback (not merely paused), so a later `play()` starts clean. Never throws. */
	stop: () => Promise< void >;
	/**
	 * Subscribes `callback` to fire the instant the player reaches `ended`
	 * (once per genuine end, not on a repeated "still ended" message).
	 * Returns an unsubscribe function. A control that can't read state at
	 * all (e.g. an unrecognized embed) returns a no-op unsubscribe and never
	 * fires.
	 */
	onEnded: ( callback: () => void ) => () => void;
	/** Releases any resources this control holds (e.g. a `message` listener, an `onEnded` subscription). Idempotent, never throws. */
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

/** The YouTube IFrame API's numeric code for the player having reached the end of the video. */
const YOUTUBE_STATE_ENDED = 0;

/** The YouTube IFrame API's numeric code for the player actively playing — used only to skip a redundant `playVideo` command. */
const YOUTUBE_STATE_PLAYING = 1;

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

/** Does nothing, successfully, and never fires `onEnded` — the fallback for anything this module doesn't know how to drive. */
const NOOP_CONTROL: VideoControl = {
	play: () => Promise.resolve(),
	stop: () => Promise.resolve(),
	onEnded: () => () => undefined,
	dispose: () => undefined,
};

/**
 * Drives a real `<video>` element through its own element API. `play()`
 * preserves the existing muted-retry fallback: unmuted autoplay without a
 * user gesture is commonly blocked, so a rejected `play()` retries muted
 * (which browsers allow) rather than leaving the element paused. `play()`
 * replays from `0` when the element has already ended, and is a no-op when
 * already playing. `stop()` is a genuine full stop: paused AND reset to `0`,
 * so a later `play()` starts clean rather than resuming mid-way. `onEnded`
 * subscribes to the element's own native `'ended'` event, which the
 * platform only ever dispatches once per genuine end.
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
	onEnded: ( callback ) => {
		el.addEventListener( 'ended', callback );
		return () => el.removeEventListener( 'ended', callback );
	},
	dispose: () => undefined,
} );

/**
 * Drives a YouTube/youtube-nocookie embed iframe by posting raw IFrame API
 * commands to its `contentWindow`, and subscribes `onEnded` by listening for
 * the player's own event messages on `window` — both confirmed against a
 * real embed (see the module doc comment). Only the transition INTO the
 * `ended` code fires the subscriber; `infoDelivery` keeps repeating `ended`
 * afterwards, and those repeats are ignored. Guards a missing
 * `contentWindow` (e.g. the iframe was detached) rather than throwing.
 * @param el
 * @param targetOrigin
 */
const youtubeIframeControl = (
	el: HTMLIFrameElement,
	targetOrigin: string
): VideoControl => {
	let lastCode: number | null = null;
	let hasPlayedOnce = false;
	let endedCallback: ( () => void ) | null = null;

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

		if ( null === code ) {
			return;
		}

		const enteredEnded =
			YOUTUBE_STATE_ENDED === code && YOUTUBE_STATE_ENDED !== lastCode;
		lastCode = code;

		if ( enteredEnded ) {
			endedCallback?.();
		}
	};

	window.addEventListener( 'message', onMessage );
	assertListening();

	return {
		play: async () => {
			if ( YOUTUBE_STATE_PLAYING === lastCode ) {
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

			if ( YOUTUBE_STATE_ENDED === lastCode ) {
				post( 'seekTo', [ 0, true ] );
			}

			post( 'playVideo' );
		},
		stop: async () => {
			post( 'stopVideo' );
		},
		onEnded: ( callback ) => {
			endedCallback = callback;
			return () => {
				if ( endedCallback === callback ) {
					endedCallback = null;
				}
			};
		},
		dispose: () => {
			window.removeEventListener( 'message', onMessage );
			endedCallback = null;
		},
	};
};

/**
 * Builds the {@link VideoControl} for whatever element `DomMotor.playVideo`
 * attended: a real `<video>` element, a YouTube/youtube-nocookie embed
 * iframe, or — a Vimeo embed, or anything else — a safe no-op that never
 * fires `onEnded`.
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
