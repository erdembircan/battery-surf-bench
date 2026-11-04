<?php
/**
 * Tests for the YouTube embed control service.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Course\YouTubeEmbed;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

use function has_filter;

/**
 * `YouTubeEmbed` never replaces WordPress's own oEmbed handling — real
 * oEmbed still resolves every YouTube URL, network fetch and all, for the
 * bundled video page and any user page alike. Its sole production touch,
 * `embed_oembed_html`, amends the `src` of a YouTube/youtube-nocookie
 * iframe WordPress's own handling already produced, via the real
 * `WP_HTML_Tag_Processor` — which this test process has no real WordPress
 * to load, so that orchestration is covered exclusively by e2e (see
 * `tests/e2e/CockpitCourse.spec.mts`).
 *
 * What IS unit-tested here is the pure logic `embed_oembed_html` delegates
 * to — {@see YouTubeEmbed::is_youtube_src()} (host detection) and
 * {@see YouTubeEmbed::amend_control_params()} (the query-param merge) —
 * neither of which touches the tag processor at all, plus the two early
 * returns of `embed_oembed_html` itself that never reach it (an empty
 * string, and HTML carrying no `<iframe` at all).
 */
final class YouTubeEmbedTest extends TestCase {

	/**
	 * Stubs `wp_parse_url()` against a fixed lookup of exact URL strings to
	 * their already-parsed component arrays, so a test can drive both the
	 * full-array form (`wp_parse_url( $url )`) and the single-component form
	 * (`wp_parse_url( $url, PHP_URL_HOST )`) the class under test uses —
	 * without reimplementing a general URL parser, which would itself have
	 * to call the discouraged raw `parse_url()`.
	 *
	 * @param array<string, array<string, mixed>> $known Exact URL string => its parsed component array.
	 */
	private function stub_wp_parse_url( array $known ): void {
		Functions\when( 'wp_parse_url' )->alias(
			static function ( string $url, int $component = -1 ) use ( $known ) {
				$parts = $known[ $url ] ?? null;

				if ( null === $parts ) {
					return false;
				}

				if ( -1 === $component ) {
					return $parts;
				}

				$map = array(
					PHP_URL_SCHEME   => 'scheme',
					PHP_URL_HOST     => 'host',
					PHP_URL_PORT     => 'port',
					PHP_URL_PATH     => 'path',
					PHP_URL_QUERY    => 'query',
					PHP_URL_FRAGMENT => 'fragment',
				);
				$key = $map[ $component ] ?? null;

				return ( null !== $key && isset( $parts[ $key ] ) ) ? $parts[ $key ] : null;
			}
		);
	}

	/**
	 * Registering hooks the single amend filter.
	 */
	public function test_register_hooks_the_embed_oembed_html_filter(): void {
		$embed = new YouTubeEmbed();
		$embed->register();

		$this->assertNotFalse( has_filter( 'embed_oembed_html', array( $embed, 'embed_oembed_html' ) ) );
	}

	/**
	 * A `youtube.com` embed iframe src is recognized.
	 */
	public function test_is_youtube_src_true_for_youtube_com(): void {
		$this->stub_wp_parse_url(
			array( 'https://www.youtube.com/embed/jNQXAC9IVRw' => array( 'host' => 'www.youtube.com' ) )
		);

		$this->assertTrue( ( new YouTubeEmbed() )->is_youtube_src( 'https://www.youtube.com/embed/jNQXAC9IVRw' ) );
	}

	/**
	 * A bare (no `www.`) `youtube.com` host is also recognized.
	 */
	public function test_is_youtube_src_true_for_a_bare_youtube_com_host(): void {
		$this->stub_wp_parse_url(
			array( 'https://youtube.com/embed/jNQXAC9IVRw' => array( 'host' => 'youtube.com' ) )
		);

		$this->assertTrue( ( new YouTubeEmbed() )->is_youtube_src( 'https://youtube.com/embed/jNQXAC9IVRw' ) );
	}

	/**
	 * A `youtube-nocookie.com` embed iframe src is recognized too.
	 */
	public function test_is_youtube_src_true_for_youtube_nocookie_com(): void {
		$this->stub_wp_parse_url(
			array(
				'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw' => array(
					'host' => 'www.youtube-nocookie.com',
				),
			)
		);

		$this->assertTrue(
			( new YouTubeEmbed() )->is_youtube_src( 'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw' )
		);
	}

	/**
	 * A host that merely CONTAINS "youtube.com" as a substring — but isn't
	 * actually that host — is not recognized. The host match is
	 * boundary-anchored specifically to rule this out, mirroring the JS
	 * side's `youtubeTargetOrigin` (`src/surfer/VideoControl.ts`).
	 */
	public function test_is_youtube_src_false_for_a_host_that_merely_contains_youtube_com(): void {
		$this->stub_wp_parse_url(
			array( 'https://myyoutube.com/watch?v=abcdefghijk' => array( 'host' => 'myyoutube.com' ) )
		);

		$this->assertFalse( ( new YouTubeEmbed() )->is_youtube_src( 'https://myyoutube.com/watch?v=abcdefghijk' ) );
	}

	/**
	 * A hyphen-prefixed lookalike host is likewise not recognized.
	 */
	public function test_is_youtube_src_false_for_a_hyphen_prefixed_lookalike_host(): void {
		$this->stub_wp_parse_url(
			array( 'https://foo-youtube.com/embed/abcdefghijk' => array( 'host' => 'foo-youtube.com' ) )
		);

		$this->assertFalse( ( new YouTubeEmbed() )->is_youtube_src( 'https://foo-youtube.com/embed/abcdefghijk' ) );
	}

	/**
	 * A non-YouTube host (Vimeo) is not recognized.
	 */
	public function test_is_youtube_src_false_for_vimeo(): void {
		$this->stub_wp_parse_url(
			array( 'https://player.vimeo.com/video/76979871' => array( 'host' => 'player.vimeo.com' ) )
		);

		$this->assertFalse( ( new YouTubeEmbed() )->is_youtube_src( 'https://player.vimeo.com/video/76979871' ) );
	}

	/**
	 * A src that fails to parse at all (no known host) is not recognized
	 * rather than fataling.
	 */
	public function test_is_youtube_src_false_for_an_unparseable_src(): void {
		$this->stub_wp_parse_url( array() );

		$this->assertFalse( ( new YouTubeEmbed() )->is_youtube_src( 'not a url at all' ) );
	}

	/**
	 * The control params are merged onto the src's existing query string,
	 * preserving whatever oEmbed already set (e.g. `feature=oembed`) and the
	 * path, on YouTube's privacy-enhanced host.
	 */
	public function test_amend_control_params_merges_onto_the_existing_query(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.org/' );
		$this->stub_wp_parse_url(
			array(
				'https://example.org/' => array(
					'scheme' => 'https',
					'host'   => 'example.org',
				),
				'https://www.youtube.com/embed/jNQXAC9IVRw?feature=oembed' => array(
					'scheme' => 'https',
					'host'   => 'www.youtube.com',
					'path'   => '/embed/jNQXAC9IVRw',
					'query'  => 'feature=oembed',
				),
			)
		);

		$amended = ( new YouTubeEmbed() )->amend_control_params(
			'https://www.youtube.com/embed/jNQXAC9IVRw?feature=oembed'
		);

		$this->assertStringStartsWith( 'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?', $amended );
		$this->assertStringContainsString( 'feature=oembed', $amended );
		$this->assertStringContainsString( 'enablejsapi=1', $amended );
		$this->assertStringContainsString( 'mute=1', $amended );
		$this->assertStringContainsString( 'playsinline=1', $amended );
		$this->assertStringContainsString( 'rel=0', $amended );
	}

	/**
	 * Every recognized YouTube host, the bare `youtube.com` included, is moved
	 * to YouTube's privacy-enhanced host; the path stays.
	 */
	public function test_amend_control_params_moves_the_embed_to_the_privacy_enhanced_host(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.org/' );
		$this->stub_wp_parse_url(
			array(
				'https://example.org/'                  => array(
					'scheme' => 'https',
					'host'   => 'example.org',
				),
				'https://youtube.com/embed/jNQXAC9IVRw' => array(
					'scheme' => 'https',
					'host'   => 'youtube.com',
					'path'   => '/embed/jNQXAC9IVRw',
				),
			)
		);

		$amended = ( new YouTubeEmbed() )->amend_control_params( 'https://youtube.com/embed/jNQXAC9IVRw' );

		$this->assertStringStartsWith( 'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?', $amended );
	}

	/**
	 * Any `autoplay` param oEmbed happened to carry is stripped — the surf
	 * engine starts playback itself, not the embed on load.
	 */
	public function test_amend_control_params_strips_autoplay(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.org/' );
		$this->stub_wp_parse_url(
			array(
				'https://example.org/' => array(
					'scheme' => 'https',
					'host'   => 'example.org',
				),
				'https://www.youtube.com/embed/jNQXAC9IVRw?autoplay=1&feature=oembed' => array(
					'scheme' => 'https',
					'host'   => 'www.youtube.com',
					'path'   => '/embed/jNQXAC9IVRw',
					'query'  => 'autoplay=1&feature=oembed',
				),
			)
		);

		$amended = ( new YouTubeEmbed() )->amend_control_params(
			'https://www.youtube.com/embed/jNQXAC9IVRw?autoplay=1&feature=oembed'
		);

		$this->assertStringNotContainsString( 'autoplay=1', $amended );
		$this->assertStringContainsString( 'feature=oembed', $amended );
	}

	/**
	 * A non-default-port site origin (e.g. the maintainer's own
	 * `http://localhost:9400` dev server) carries its port through into the
	 * `origin` param — YouTube's JS API validates `origin` against the real
	 * parent origin including port, so dropping it would silently break
	 * every `playVideo`/`pauseVideo` postMessage command on such a host.
	 */
	public function test_amend_control_params_includes_the_port_in_the_origin_param_when_present(): void {
		Functions\when( 'home_url' )->justReturn( 'http://localhost:9400/' );
		$this->stub_wp_parse_url(
			array(
				'http://localhost:9400/' => array(
					'scheme' => 'http',
					'host'   => 'localhost',
					'port'   => 9400,
				),
				'https://www.youtube.com/embed/jNQXAC9IVRw' => array(
					'scheme' => 'https',
					'host'   => 'www.youtube.com',
					'path'   => '/embed/jNQXAC9IVRw',
				),
			)
		);

		$amended = ( new YouTubeEmbed() )->amend_control_params( 'https://www.youtube.com/embed/jNQXAC9IVRw' );

		// http_build_query() percent-encodes the origin's `:`/`/` characters.
		$this->assertStringContainsString( 'origin=http%3A%2F%2Flocalhost%3A9400', $amended );
	}

	/**
	 * A default-port origin carries no port suffix — only a genuinely
	 * non-default port is appended.
	 */
	public function test_amend_control_params_omits_the_port_for_a_default_port_origin(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.org/' );
		$this->stub_wp_parse_url(
			array(
				'https://example.org/' => array(
					'scheme' => 'https',
					'host'   => 'example.org',
				),
				'https://www.youtube.com/embed/jNQXAC9IVRw' => array(
					'scheme' => 'https',
					'host'   => 'www.youtube.com',
					'path'   => '/embed/jNQXAC9IVRw',
				),
			)
		);

		$amended = ( new YouTubeEmbed() )->amend_control_params( 'https://www.youtube.com/embed/jNQXAC9IVRw' );

		$this->assertStringContainsString( 'origin=https%3A%2F%2Fexample.org', $amended );
		$this->assertStringNotContainsString( 'origin=https%3A%2F%2Fexample.org%3A', $amended );
	}

	/**
	 * Running the amend again on its own output changes nothing further.
	 */
	public function test_amend_control_params_is_idempotent(): void {
		Functions\when( 'home_url' )->justReturn( 'https://example.org/' );
		$src = 'https://www.youtube.com/embed/jNQXAC9IVRw?feature=oembed';

		$this->stub_wp_parse_url(
			array(
				'https://example.org/' => array(
					'scheme' => 'https',
					'host'   => 'example.org',
				),
				$src                   => array(
					'scheme' => 'https',
					'host'   => 'www.youtube.com',
					'path'   => '/embed/jNQXAC9IVRw',
					'query'  => 'feature=oembed',
				),
			)
		);

		$embed = new YouTubeEmbed();
		$once  = $embed->amend_control_params( $src );

		// Re-stub so the amend's own output also resolves: a plain string
		// split, not a parser, since $once's shape (the privacy-enhanced host,
		// the same path, a new query) is already known from building it above.
		$once_parts = explode( '?', $once, 2 );
		$this->stub_wp_parse_url(
			array(
				'https://example.org/' => array(
					'scheme' => 'https',
					'host'   => 'example.org',
				),
				$once                  => array(
					'scheme' => 'https',
					'host'   => 'www.youtube-nocookie.com',
					'path'   => '/embed/jNQXAC9IVRw',
					'query'  => $once_parts[1] ?? '',
				),
			)
		);

		$twice = $embed->amend_control_params( $once );

		$this->assertSame( $once, $twice );
	}

	/**
	 * An empty string is returned untouched — this returns before
	 * `embed_oembed_html` ever constructs a `WP_HTML_Tag_Processor`.
	 */
	public function test_embed_oembed_html_leaves_an_empty_string_untouched(): void {
		$this->assertSame( '', ( new YouTubeEmbed() )->embed_oembed_html( '' ) );
	}

	/**
	 * HTML with no iframe at all is returned untouched rather than fataling
	 * — this also returns before a `WP_HTML_Tag_Processor` is constructed.
	 */
	public function test_embed_oembed_html_leaves_html_with_no_iframe_untouched(): void {
		$html = '<blockquote>Not an embed.</blockquote>';

		$this->assertSame( $html, ( new YouTubeEmbed() )->embed_oembed_html( $html ) );
	}
}
