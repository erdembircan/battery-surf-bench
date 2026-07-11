/**
 * Starts and stops the page's video or video-host embed. `DomMotor.playVideo`
 * builds one of these for whatever element it attends and keeps it so
 * `stopVideo` can pause the exact same thing later — `WatchVideo.run` drives
 * the resulting start → dwell → stop sequence.
 *
 * A real `<video>` is driven through its own element API. A YouTube (or
 * youtube-nocookie) embed is driven through the IFrame API's raw
 * `postMessage` command protocol — no `iframe_api` remote script is loaded;
 * the embed's own `src` already carries `enablejsapi=1` (see
 * `YouTubeEmbed.php`), which is all a page needs to accept these commands.
 * Anything else (a Vimeo embed, or a YouTube iframe whose `src` doesn't
 * resolve to a parseable origin) is a safe no-op in both directions, so a
 * page with an embed this module doesn't know how to drive behaves exactly
 * as it did before: attended, never actually started or stopped.
 */

/** A motion primitive that starts and stops whatever element it was built for. */
export interface VideoControl {
	/** Starts playback. Never throws. */
	play: () => Promise< void >;
	/** Pauses playback. Never throws. */
	pause: () => Promise< void >;
}

/** A YouTube IFrame API command, as the raw `postMessage` protocol expects it. */
type YouTubeCommand = 'playVideo' | 'pauseVideo';

/**
 * Hosts whose embed iframe accepts the YouTube IFrame API's postMessage
 * command protocol.
 */
const YOUTUBE_HOST_PATTERN = /(?:^|\.)youtube(?:-nocookie)?\.com$/;

/**
 * Serializes a YouTube IFrame API command the way its raw `postMessage`
 * protocol expects — `{event: 'command', func, args: []}` — rather than
 * loading the `iframe_api` remote script just to get a typed wrapper around
 * the same message.
 * @param func
 */
const youtubeCommand = ( func: YouTubeCommand ): string =>
	JSON.stringify( { event: 'command', func, args: [] } );

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

/** Does nothing, successfully — the fallback for anything this module doesn't know how to drive. */
const NOOP_CONTROL: VideoControl = {
	play: () => Promise.resolve(),
	pause: () => Promise.resolve(),
};

/**
 * Drives a real `<video>` element through its own element API. `play()`
 * preserves the existing muted-retry fallback: unmuted autoplay without a
 * user gesture is commonly blocked, so a rejected `play()` retries muted
 * (which browsers allow) rather than leaving the element paused.
 * @param el
 */
const videoElementControl = ( el: HTMLVideoElement ): VideoControl => ( {
	play: async () => {
		try {
			await el.play();
		} catch {
			el.muted = true;
			await el.play().catch( () => undefined );
		}
	},
	pause: async () => {
		el.pause();
	},
} );

/**
 * Drives a YouTube/youtube-nocookie embed iframe by posting a raw IFrame API
 * command to its `contentWindow`. Guards a missing `contentWindow` (e.g. the
 * iframe was detached) rather than throwing.
 * @param el
 * @param targetOrigin
 */
const youtubeIframeControl = (
	el: HTMLIFrameElement,
	targetOrigin: string
): VideoControl => ( {
	play: async () => {
		el.contentWindow?.postMessage(
			youtubeCommand( 'playVideo' ),
			targetOrigin
		);
	},
	pause: async () => {
		el.contentWindow?.postMessage(
			youtubeCommand( 'pauseVideo' ),
			targetOrigin
		);
	},
} );

/**
 * Builds the {@link VideoControl} for whatever element `DomMotor.playVideo`
 * attended: a real `<video>` element, a YouTube/youtube-nocookie embed
 * iframe, or — a Vimeo embed, or anything else — a safe no-op in both
 * directions.
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
