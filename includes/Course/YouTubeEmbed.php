<?php
/**
 * YouTube embed control service.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use ErdemBircan\BatterySurfBench\Course\Views\YouTubeEmbedView;
use WP_HTML_Tag_Processor;

use function add_filter;
use function esc_attr__;
use function esc_url;
use function home_url;
use function is_string;
use function preg_match;
use function str_contains;
use function wp_parse_url;

defined( 'ABSPATH' ) || exit;

/**
 * Makes a YouTube (or youtube-nocookie) embed on a served course page
 * deterministic (offline-safe) and controllable through the surf engine's
 * `VideoControl` (see `src/surfer/VideoControl.ts`), scoped to course
 * rendering by {@see CourseRouter}, which registers this service only while
 * serving a course page.
 *
 * Two `WP_Embed` filters are hooked, because a YouTube embed can reach a
 * served page through either path and both must carry the same control
 * params:
 *
 * - `pre_oembed_result` builds the iframe locally for a recognized YouTube
 *   URL, short-circuiting `WP_oEmbed::get_html()` before it would otherwise
 *   make a network request — this is what keeps rendering the bundled video
 *   course page (and any user page carrying a bare YouTube URL) offline and
 *   deterministic.
 * - `embed_oembed_html` normalizes ANY youtube/youtube-nocookie iframe HTML
 *   that reaches `WP_Embed::shortcode()` — including a result already
 *   cached from before this service existed, which never runs through
 *   `pre_oembed_result` at all (`WP_Embed::shortcode()` returns a cache hit
 *   straight through this filter) — guaranteeing the same control params on
 *   every path. It is idempotent: running it again on its own output leaves
 *   it unchanged.
 *
 * Neither filter touches a non-YouTube URL/iframe (Vimeo, or anything else)
 * — the passed value is returned unchanged.
 */
class YouTubeEmbed {

	/** Matches a YouTube video id: 11 characters from YouTube's URL-safe id alphabet. */
	private const VIDEO_ID_PATTERN = '[A-Za-z0-9_-]{11}';

	/**
	 * Stores the view the offline base iframe's markup is rendered through.
	 *
	 * @param YouTubeEmbedView $view Renders the base iframe's markup.
	 */
	public function __construct( private YouTubeEmbedView $view ) {
	}

	/**
	 * Hooks the offline base and the normalizer.
	 *
	 * @return void
	 */
	public function register(): void {
		// Only as many of each hook's arguments as this class actually reads
		// are declared/accepted — `pre_oembed_result` also carries oEmbed
		// `$args`, and `embed_oembed_html` also carries `$url`/`$attr`/
		// `$post_id`, but every recognized YouTube URL gets the exact same
		// control params regardless, and the iframe's own `src` (read back
		// via `WP_HTML_Tag_Processor`) is the only authoritative source for
		// the normalizer.
		add_filter( 'pre_oembed_result', array( $this, 'pre_oembed_result' ), 10, 2 );
		add_filter( 'embed_oembed_html', array( $this, 'embed_oembed_html' ), 10, 1 );
	}

	/**
	 * Builds a deterministic, offline base iframe for a recognized YouTube
	 * URL, short-circuiting `WP_oEmbed::get_html()`'s network fetch. A
	 * non-YouTube (or unrecognized) URL is left to WordPress's normal oEmbed
	 * flow by returning `$result` unchanged.
	 *
	 * @param mixed  $result The oEmbed result so far — null continues WordPress's normal (network) flow.
	 * @param string $url    The URL being embedded.
	 * @return mixed The base iframe HTML for a recognized YouTube URL, else `$result` unchanged.
	 */
	public function pre_oembed_result( $result, string $url ) {
		$id = $this->parse_video_id( $url );

		if ( null === $id ) {
			return $result;
		}

		return $this->view->render(
			array(
				'src'   => esc_url( $this->build_src( $id ) ),
				'title' => esc_attr__( 'YouTube video player', 'battery-surf-bench' ),
			)
		);
	}

	/**
	 * Normalizes any YouTube/youtube-nocookie iframe HTML — from a fresh
	 * fetch, from {@see pre_oembed_result()} above, or from a pre-existing
	 * cache — so its `src` always carries the control params the surf
	 * engine's `VideoControl` needs, with autoplay stripped. HTML with no
	 * recognized YouTube iframe (a non-YouTube embed, or no iframe at all) is
	 * returned unchanged. Idempotent: running it again on its own output
	 * changes nothing further.
	 *
	 * @param string $html The embed HTML (cached or freshly fetched).
	 * @return string The normalized HTML.
	 */
	public function embed_oembed_html( string $html ): string {
		if ( '' === $html || ! str_contains( $html, '<iframe' ) ) {
			return $html;
		}

		$processor = new WP_HTML_Tag_Processor( $html );

		while ( $processor->next_tag( 'iframe' ) ) {
			$src = $processor->get_attribute( 'src' );

			if ( ! is_string( $src ) ) {
				continue;
			}

			$id = $this->parse_video_id( $src );

			if ( null === $id ) {
				continue;
			}

			// `set_attribute()` escapes a URI-bearing attribute's value with
			// `esc_url()` itself (it recognizes `src` as one), so the raw,
			// unescaped src is passed here — escaping it again here would
			// double-escape it.
			$processor->set_attribute( 'src', $this->build_src( $id ) );
		}

		return $processor->get_updated_html();
	}

	/**
	 * Extracts an 11-character YouTube video id from any recognized YouTube
	 * URL form: `youtube.com/watch?v=`, `youtu.be/`, or
	 * `youtube(-nocookie).com/embed/` — each tolerant of extra query params.
	 *
	 * @param string $url The URL to inspect.
	 * @return string|null The video id, or null when the URL is not a recognized YouTube URL.
	 */
	public function parse_video_id( string $url ): ?string {
		$pattern = '#(?:youtube(?:-nocookie)?\.com/(?:watch\?(?:.*&)?v=|embed/)|youtu\.be/)(' . self::VIDEO_ID_PATTERN . ')#i';

		if ( 1 === preg_match( $pattern, $url, $matches ) ) {
			return $matches[1];
		}

		return null;
	}

	/**
	 * Builds the control-ready iframe src for a video id: JS-API enabled,
	 * muted so a programmatic `playVideo` command is allowed under browser
	 * autoplay policy, no related-video panel, and carrying the served
	 * page's own origin so YouTube accepts the surf engine's postMessage
	 * commands. Deliberately carries no `autoplay`/`loop` — the surf engine
	 * starts and stops playback itself.
	 *
	 * @param string $id The YouTube video id.
	 * @return string The unescaped iframe src URL.
	 */
	private function build_src( string $id ): string {
		$origin = $this->origin();

		return "https://www.youtube-nocookie.com/embed/{$id}?enablejsapi=1&playsinline=1&mute=1&rel=0&origin={$origin}";
	}

	/**
	 * The served page's own scheme+host, so the embedded player accepts the
	 * surf engine's postMessage commands (YouTube's JS API validates the
	 * `origin` param against the frame that is actually controlling it).
	 *
	 * @return string The site's origin (`scheme://host`), or '' when it cannot be determined.
	 */
	private function origin(): string {
		$parts = wp_parse_url( home_url( '/' ) );

		if ( ! isset( $parts['scheme'], $parts['host'] ) ) {
			return '';
		}

		return "{$parts['scheme']}://{$parts['host']}";
	}
}
