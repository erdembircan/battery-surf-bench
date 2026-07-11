<?php
/**
 * Tests for the YouTube embed control service.
 *
 * @package ErdemBircan\BatterySurfBench
 */

declare( strict_types=1 );

namespace ErdemBircan\BatterySurfBench\Tests\Course;

use Brain\Monkey\Functions;
use ErdemBircan\BatterySurfBench\Course\Views\YouTubeEmbedView;
use ErdemBircan\BatterySurfBench\Course\YouTubeEmbed;
use ErdemBircan\BatterySurfBench\Tests\TestCase;

use function has_filter;

/**
 * `YouTubeEmbed` keeps a YouTube (or youtube-nocookie) embed on a served
 * course page offline/deterministic (`pre_oembed_result`) and controllable
 * by the surf engine (`embed_oembed_html`, which normalizes ANY YouTube
 * iframe HTML reaching `WP_Embed::shortcode()`, including a pre-existing
 * cache hit that never runs through `pre_oembed_result` at all).
 */
final class YouTubeEmbedTest extends TestCase {

	/**
	 * Stubs the WordPress functions `YouTubeEmbed` calls to build its control
	 * params: `home_url()` (the origin source) and `wp_parse_url()` (a thin
	 * `parse_url()` wrapper in real WordPress, stubbed here as exactly that).
	 */
	protected function setUp(): void {
		parent::setUp();

		Functions\when( 'home_url' )->justReturn( 'https://example.org/' );
		// `wp_parse_url()` is a thin, WordPress-only wrapper around PHP's
		// `parse_url()` — stubbed here with the fixed result for the one URL
		// `home_url( '/' )` above ever produces in these tests, rather than
		// reimplementing a general parser (which would itself have to call
		// the discouraged raw `parse_url()`).
		Functions\when( 'wp_parse_url' )->justReturn(
			array(
				'scheme' => 'https',
				'host'   => 'example.org',
			)
		);
	}

	/**
	 * Builds the service under test.
	 *
	 * @return YouTubeEmbed The service under test.
	 */
	private function embed(): YouTubeEmbed {
		return new YouTubeEmbed( new YouTubeEmbedView() );
	}

	/**
	 * A `youtube.com/watch?v=` URL resolves to its video id.
	 */
	public function test_parse_video_id_from_a_watch_url(): void {
		$this->assertSame(
			'jNQXAC9IVRw',
			$this->embed()->parse_video_id( 'https://www.youtube.com/watch?v=jNQXAC9IVRw' )
		);
	}

	/**
	 * A `youtube.com/watch?v=` URL with the id positioned after other query
	 * params still resolves.
	 */
	public function test_parse_video_id_from_a_watch_url_with_extra_leading_params(): void {
		$this->assertSame(
			'jNQXAC9IVRw',
			$this->embed()->parse_video_id( 'https://www.youtube.com/watch?feature=share&v=jNQXAC9IVRw' )
		);
	}

	/**
	 * A `youtube.com/watch?v=` URL with trailing extra params still resolves.
	 */
	public function test_parse_video_id_from_a_watch_url_with_extra_trailing_params(): void {
		$this->assertSame(
			'jNQXAC9IVRw',
			$this->embed()->parse_video_id( 'https://www.youtube.com/watch?v=jNQXAC9IVRw&list=xyz' )
		);
	}

	/**
	 * A `youtu.be/` short URL resolves to its video id.
	 */
	public function test_parse_video_id_from_a_short_url(): void {
		$this->assertSame(
			'jNQXAC9IVRw',
			$this->embed()->parse_video_id( 'https://youtu.be/jNQXAC9IVRw' )
		);
	}

	/**
	 * A `youtu.be/` short URL with extra query params still resolves.
	 */
	public function test_parse_video_id_from_a_short_url_with_extra_params(): void {
		$this->assertSame(
			'jNQXAC9IVRw',
			$this->embed()->parse_video_id( 'https://youtu.be/jNQXAC9IVRw?t=42' )
		);
	}

	/**
	 * A `youtube.com/embed/` URL resolves to its video id.
	 */
	public function test_parse_video_id_from_a_youtube_com_embed_url(): void {
		$this->assertSame(
			'jNQXAC9IVRw',
			$this->embed()->parse_video_id( 'https://www.youtube.com/embed/jNQXAC9IVRw' )
		);
	}

	/**
	 * A `youtube-nocookie.com/embed/` URL resolves to its video id, extra
	 * query params included.
	 */
	public function test_parse_video_id_from_a_nocookie_embed_url_with_extra_params(): void {
		$this->assertSame(
			'jNQXAC9IVRw',
			$this->embed()->parse_video_id( 'https://www.youtube-nocookie.com/embed/jNQXAC9IVRw?feature=oembed' )
		);
	}

	/**
	 * A Vimeo URL is not a recognized YouTube URL.
	 */
	public function test_parse_video_id_returns_null_for_a_vimeo_url(): void {
		$this->assertNull( $this->embed()->parse_video_id( 'https://player.vimeo.com/video/76979871' ) );
	}

	/**
	 * A host that merely CONTAINS "youtube.com" as a substring — but isn't
	 * actually that host — is not a recognized YouTube URL. The host match is
	 * boundary-anchored specifically to rule this out.
	 */
	public function test_parse_video_id_returns_null_for_a_host_that_merely_contains_youtube_com(): void {
		$this->assertNull( $this->embed()->parse_video_id( 'https://myyoutube.com/watch?v=abcdefghijk' ) );
	}

	/**
	 * A hyphen-prefixed lookalike host is likewise not recognized.
	 */
	public function test_parse_video_id_returns_null_for_a_hyphen_prefixed_lookalike_host(): void {
		$this->assertNull( $this->embed()->parse_video_id( 'https://foo-youtube.com/embed/abcdefghijk' ) );
	}

	/**
	 * The genuine host still resolves — the boundary anchor doesn't over-tighten.
	 */
	public function test_parse_video_id_still_resolves_the_genuine_host(): void {
		$this->assertSame(
			'abcdefghijk',
			$this->embed()->parse_video_id( 'https://www.youtube.com/watch?v=abcdefghijk' )
		);
	}

	/**
	 * A non-URL string is not a recognized YouTube URL.
	 */
	public function test_parse_video_id_returns_null_for_garbage(): void {
		$this->assertNull( $this->embed()->parse_video_id( 'not a url at all' ) );
	}

	/**
	 * Registering hooks both filters.
	 */
	public function test_register_hooks_both_filters(): void {
		$embed = $this->embed();
		$embed->register();

		$this->assertNotFalse( has_filter( 'pre_oembed_result', array( $embed, 'pre_oembed_result' ) ) );
		$this->assertNotFalse( has_filter( 'embed_oembed_html', array( $embed, 'embed_oembed_html' ) ) );
	}

	/**
	 * A recognized YouTube URL builds the offline base iframe: JS-API
	 * enabled, carrying the video id, on the nocookie host, with no
	 * autoplay.
	 */
	public function test_pre_oembed_result_builds_the_offline_base_for_a_youtube_url(): void {
		$html = $this->embed()->pre_oembed_result( null, 'https://www.youtube.com/watch?v=jNQXAC9IVRw' );

		$this->assertIsString( $html );
		$this->assertStringContainsString( 'enablejsapi=1', $html );
		$this->assertStringContainsString( 'jNQXAC9IVRw', $html );
		$this->assertStringContainsString( 'youtube-nocookie.com/embed', $html );
		// Not the `autoplay=1` query param — the iframe's `allow` attribute
		// legitimately carries the bare `autoplay` *permission* token (the
		// browser feature policy that lets the surf engine's later
		// `postMessage` command actually start playback), which is a
		// different thing entirely.
		$this->assertStringNotContainsString( 'autoplay=1', $html );
	}

	/**
	 * A non-default-port site origin (e.g. the maintainer's own
	 * `http://localhost:9400` dev server) carries its port through into the
	 * `origin` param — YouTube's JS API validates `origin` against the real
	 * parent origin including port, so dropping it would silently break every
	 * `playVideo`/`pauseVideo` postMessage command on such a host.
	 */
	public function test_pre_oembed_result_includes_the_port_in_the_origin_param_when_present(): void {
		Functions\when( 'home_url' )->justReturn( 'http://localhost:9400/' );
		Functions\when( 'wp_parse_url' )->justReturn(
			array(
				'scheme' => 'http',
				'host'   => 'localhost',
				'port'   => 9400,
			)
		);

		$html = $this->embed()->pre_oembed_result( null, 'https://www.youtube.com/watch?v=jNQXAC9IVRw' );

		$this->assertStringContainsString( 'origin=http://localhost:9400', $html );
	}

	/**
	 * A default-port origin (the class-level `setUp()` stub) carries no port
	 * suffix — only a genuinely non-default port is appended.
	 */
	public function test_pre_oembed_result_omits_the_port_for_a_default_port_origin(): void {
		$html = $this->embed()->pre_oembed_result( null, 'https://www.youtube.com/watch?v=jNQXAC9IVRw' );

		$this->assertStringContainsString( 'origin=https://example.org', $html );
		$this->assertStringNotContainsString( 'example.org:', $html );
	}

	/**
	 * A non-YouTube URL is left to WordPress's normal oEmbed flow: the
	 * passed-through result (null, to continue) is returned unchanged.
	 */
	public function test_pre_oembed_result_leaves_a_non_youtube_url_unchanged(): void {
		$this->assertNull(
			$this->embed()->pre_oembed_result( null, 'https://player.vimeo.com/video/76979871' )
		);
	}

	/**
	 * A non-null passed-through result (e.g. another filter already resolved
	 * it) is preserved for a non-YouTube URL.
	 */
	public function test_pre_oembed_result_preserves_an_existing_result_for_a_non_youtube_url(): void {
		$this->assertSame(
			'<iframe src="https://player.vimeo.com/video/76979871"></iframe>',
			$this->embed()->pre_oembed_result(
				'<iframe src="https://player.vimeo.com/video/76979871"></iframe>',
				'https://player.vimeo.com/video/76979871'
			)
		);
	}

	/**
	 * A freshly fetched (or cached) YouTube iframe is normalized to carry the
	 * control params, with no autoplay.
	 */
	public function test_embed_oembed_html_normalizes_a_youtube_iframe(): void {
		$html = $this->embed()->embed_oembed_html(
			'<iframe src="https://www.youtube.com/embed/jNQXAC9IVRw?feature=oembed"></iframe>'
		);

		$this->assertStringContainsString( 'enablejsapi=1', $html );
		$this->assertStringContainsString( 'mute=1', $html );
		$this->assertStringContainsString( 'origin=', $html );
		$this->assertStringNotContainsString( 'autoplay', $html );
	}

	/**
	 * Normalizing already-normalized HTML changes nothing further.
	 */
	public function test_embed_oembed_html_is_idempotent(): void {
		$embed = $this->embed();
		$once  = $embed->embed_oembed_html(
			'<iframe src="https://www.youtube.com/embed/jNQXAC9IVRw?feature=oembed"></iframe>'
		);
		$twice = $embed->embed_oembed_html( $once );

		$this->assertSame( $once, $twice );
	}

	/**
	 * A non-YouTube iframe (Vimeo) is returned completely untouched.
	 */
	public function test_embed_oembed_html_leaves_a_non_youtube_iframe_untouched(): void {
		$html = '<iframe src="https://player.vimeo.com/video/76979871"></iframe>';

		$this->assertSame( $html, $this->embed()->embed_oembed_html( $html ) );
	}

	/**
	 * HTML with no iframe at all is returned untouched rather than fataling.
	 */
	public function test_embed_oembed_html_leaves_html_with_no_iframe_untouched(): void {
		$html = '<blockquote>Not an embed.</blockquote>';

		$this->assertSame( $html, $this->embed()->embed_oembed_html( $html ) );
	}

	/**
	 * An empty string is returned untouched.
	 */
	public function test_embed_oembed_html_leaves_an_empty_string_untouched(): void {
		$this->assertSame( '', $this->embed()->embed_oembed_html( '' ) );
	}
}
