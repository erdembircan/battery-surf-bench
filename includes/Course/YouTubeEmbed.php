<?php
/**
 * YouTube embed control service.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench\Course;

use WP_HTML_Tag_Processor;

use function add_filter;
use function array_merge;
use function home_url;
use function http_build_query;
use function is_string;
use function parse_str;
use function preg_match;
use function str_contains;
use function wp_parse_url;

defined( 'ABSPATH' ) || exit;

/**
 * Amends the `src` of a YouTube (or youtube-nocookie) iframe that WordPress's
 * OWN native oEmbed handling already produced — for the bundled video course
 * page and any user-selected surf page alike — so the surf engine's
 * `VideoControl` (see `src/surfer/VideoControl.ts`) can start and stop
 * playback through YouTube's IFrame API. Registered by {@see CourseRouter}
 * per served course page.
 *
 * This does NOT replace WordPress's embedding machinery. Real oEmbed still
 * resolves every YouTube URL exactly as it would on any WordPress site —
 * network fetch and all — for the bundled page and a user's own page alike.
 * The single production touch is `embed_oembed_html`, which rebuilds the
 * `src` WordPress's `WP_Embed::shortcode()` already built, for ANY iframe
 * reaching that filter (a fresh fetch or a pre-existing cache hit): it moves
 * the embed to YouTube's privacy-enhanced host, `www.youtube-nocookie.com`,
 * keeps the path and every param oEmbed set (e.g. `feature=oembed`), and
 * merges four control params onto them:
 *
 * - `enablejsapi=1` — required for the postMessage command protocol; without
 *   it the surf engine cannot control playback at all.
 * - `mute=1` — a programmatic (non-user-gesture) `playVideo` command is only
 *   honored under browser autoplay policy when the player is muted.
 * - `playsinline=1`, `rel=0` — cosmetic/UX parity with a typical embed.
 * - `origin={home origin, port included}` — required by YouTube's IFrame API
 *   for it to accept postMessage commands from this page at all.
 *
 * YouTube says its privacy-enhanced mode stores nothing about a viewer until
 * the video plays, and keeps embedded views out of their YouTube
 * recommendations. Its player answers the IFrame API's postMessage protocol
 * exactly as `www.youtube.com`'s does: both were driven through the same
 * play, natural end, replay and stop sequence and answered message for
 * message alike.
 *
 * Any `autoplay` param oEmbed happened to carry is stripped — the surf
 * engine starts playback itself, not the embed on load. The amend is
 * idempotent and touches only a recognized YouTube/youtube-nocookie host
 * (boundary-anchored: a lookalike host like `myyoutube.com` is left
 * completely untouched), never any other iframe (Vimeo, etc.).
 *
 * wp-playground (both the persistent dev server and the non-persistent e2e
 * instances) has no reliable outbound network, so real oEmbed there yields
 * no iframe at all — a dev/e2e-only mu-plugin
 * (`wp-playground/blueprint.mts`'s `youtubeOembedStubMuPlugin`) stubs that
 * one HTTP fetch so this class's real, unmodified production code still has
 * something to amend. Production carries no such stub.
 */
class YouTubeEmbed {

	/**
	 * Where every amended embed loads its player from: YouTube's
	 * privacy-enhanced host (see the class doc comment).
	 *
	 * @var string
	 */
	private const PLAYER_ORIGIN = 'https://www.youtube-nocookie.com';

	/**
	 * Hooks the amend.
	 *
	 * @return void
	 */
	public function register(): void {
		// `embed_oembed_html` also carries `$url`/`$attr`/`$post_id`, but the
		// iframe's own `src` (read back via `WP_HTML_Tag_Processor`) is the
		// only thing this amend needs.
		add_filter( 'embed_oembed_html', array( $this, 'embed_oembed_html' ), 10, 1 );
	}

	/**
	 * Amends the `src` of any YouTube/youtube-nocookie iframe in the given
	 * embed HTML — HTML WordPress's own oEmbed handling produced, from a
	 * fresh fetch or a pre-existing cache hit — with the control params
	 * described in the class doc comment. HTML with no recognized YouTube
	 * iframe (a non-YouTube embed, or no iframe at all) is returned
	 * unchanged. Idempotent: running it again on its own output changes
	 * nothing further.
	 *
	 * @param string $html The embed HTML WordPress's own oEmbed handling produced.
	 * @return string The amended HTML.
	 */
	public function embed_oembed_html( string $html ): string {
		if ( '' === $html || ! str_contains( $html, '<iframe' ) ) {
			return $html;
		}

		$processor = new WP_HTML_Tag_Processor( $html );

		while ( $processor->next_tag( 'iframe' ) ) {
			$src = $processor->get_attribute( 'src' );

			if ( ! is_string( $src ) || ! $this->is_youtube_src( $src ) ) {
				continue;
			}

			// `set_attribute()` escapes a URI-bearing attribute's value with
			// `esc_url()` itself (it recognizes `src` as one), so the raw,
			// unescaped amended src is passed here — escaping it again here
			// would double-escape it.
			$processor->set_attribute( 'src', $this->amend_control_params( $src ) );
		}

		return $processor->get_updated_html();
	}

	/**
	 * Whether `$src`'s host is a genuine YouTube/youtube-nocookie host —
	 * boundary-anchored (the host must equal `youtube(-nocookie).com` or end
	 * with `.youtube(-nocookie).com`), so a host that merely CONTAINS that
	 * substring (`myyoutube.com`, `foo-youtube.com`) is never mistaken for
	 * it. Mirrors the JS side's `youtubeTargetOrigin`
	 * (`src/surfer/VideoControl.ts`), which applies the same boundary rule to
	 * `URL.hostname`.
	 *
	 * Public (rather than the class's sole private detail) specifically so
	 * this pure host-detection logic — which touches no
	 * `WP_HTML_Tag_Processor` — is unit-testable on its own; see
	 * `tests/Course/YouTubeEmbedTest.php`.
	 *
	 * @param string $src The iframe src to inspect.
	 * @return bool Whether the host is a recognized YouTube host.
	 */
	public function is_youtube_src( string $src ): bool {
		$host = wp_parse_url( $src, PHP_URL_HOST );

		if ( ! is_string( $host ) ) {
			return false;
		}

		return 1 === preg_match( '#(?:^|\.)youtube(?:-nocookie)?\.com$#i', $host );
	}

	/**
	 * Rebuilds `$src` on YouTube's privacy-enhanced host,
	 * `www.youtube-nocookie.com`, keeping its path, fragment and every
	 * existing param except `autoplay`, and merges the control params
	 * described in the class doc comment onto them.
	 *
	 * Public (rather than the class's sole private detail) specifically so
	 * this pure param-merge logic — which touches no
	 * `WP_HTML_Tag_Processor` — is unit-testable on its own; see
	 * `tests/Course/YouTubeEmbedTest.php`.
	 *
	 * @param string $src A YouTube/youtube-nocookie iframe src, already confirmed by {@see is_youtube_src()}.
	 * @return string The amended, unescaped src.
	 */
	public function amend_control_params( string $src ): string {
		$parts = wp_parse_url( $src );

		if ( ! isset( $parts['scheme'], $parts['host'] ) ) {
			return $src;
		}

		parse_str( $parts['query'] ?? '', $query );
		unset( $query['autoplay'] );

		$query = array_merge(
			$query,
			array(
				'enablejsapi' => '1',
				'mute'        => '1',
				'playsinline' => '1',
				'rel'         => '0',
				'origin'      => $this->origin(),
			)
		);

		$amended  = self::PLAYER_ORIGIN . ( $parts['path'] ?? '' );
		$amended .= '?' . http_build_query( $query, '', '&' );

		if ( isset( $parts['fragment'] ) ) {
			$amended .= '#' . $parts['fragment'];
		}

		return $amended;
	}

	/**
	 * The served page's own scheme+host(+port), so the embedded player
	 * accepts the surf engine's postMessage commands — YouTube's JS API
	 * validates the `origin` param against the frame that is actually
	 * controlling it, port included, so a non-default-port dev host (e.g.
	 * `http://localhost:9400`) must carry its port here or every command is
	 * silently ignored as a mismatched origin.
	 *
	 * @return string The site's origin (`scheme://host` or `scheme://host:port`), or '' when it cannot be determined.
	 */
	private function origin(): string {
		$parts = wp_parse_url( home_url( '/' ) );

		if ( ! isset( $parts['scheme'], $parts['host'] ) ) {
			return '';
		}

		$origin = "{$parts['scheme']}://{$parts['host']}";

		if ( isset( $parts['port'] ) ) {
			$origin .= ":{$parts['port']}";
		}

		return $origin;
	}
}
