<?php
/**
 * Plugin bootstrap.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Admin\SessionsScreen;
use ErdemBircan\BatterySurfBench\Admin\SettingsScreen;
use ErdemBircan\BatterySurfBench\Admin\StartBenchmark;
use ErdemBircan\BatterySurfBench\Admin\Views\StartBenchmarkView;
use ErdemBircan\BatterySurfBench\Cockpit\Cockpit;
use ErdemBircan\BatterySurfBench\Cockpit\Views\CockpitDashboard;
use ErdemBircan\BatterySurfBench\Cockpit\Views\SessionDetailView;
use ErdemBircan\BatterySurfBench\Content\SessionDetail;
use ErdemBircan\BatterySurfBench\Content\SessionRestQuery;
use ErdemBircan\BatterySurfBench\Content\SessionSchema;
use ErdemBircan\BatterySurfBench\Content\SessionType;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderOption;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Course\CourseRouter;
use ErdemBircan\BatterySurfBench\Course\Views\UserPageView;
use ErdemBircan\BatterySurfBench\DevTools\DevTools;
use ErdemBircan\BatterySurfBench\DevTools\Views\DevToolsPanelView;
use ErdemBircan\BatterySurfBench\Settings\OptionRegistry;
use ErdemBircan\BatterySurfBench\Support\Manager;
use ErdemBircan\BatterySurfBench\Support\StandaloneChrome;

use function explode;

defined( 'ABSPATH' ) || exit;

/**
 * Bootstraps the Battery Surf Bench plugin.
 */
class BatterySurfBench {

	/**
	 * The plugin's read-only configuration registry. Owned solely by the
	 * bootstrap; components receive only the values they need, never the
	 * registry itself.
	 *
	 * @var Registry
	 */
	private Registry $registry;

	/**
	 * Resolves filesystem paths and URLs for the assets shipped with the plugin.
	 *
	 * @var Paths
	 */
	private Paths $paths;

	/**
	 * Enqueues the plugin's script and style files.
	 *
	 * @var Assets
	 */
	private Assets $assets;

	/**
	 * Stores the plugin file path. No work is done here so the object can be
	 * constructed without side effects.
	 *
	 * @param string $plugin_file Absolute path to the main plugin file.
	 */
	public function __construct( private string $plugin_file ) {
	}

	/**
	 * Boots the plugin: builds the registry, path resolver and asset service,
	 * then registers its managers.
	 */
	public function init(): void {
		$this->registry = new Registry( require __DIR__ . '/Config.php' );
		$this->paths    = new Paths( $this->plugin_file );
		$this->assets   = new Assets( $this->registry->get( 'namespace' ), $this->paths );

		foreach ( $this->managers() as $manager ) {
			$manager->register();
		}
	}

	/**
	 * Builds the managers that make up the plugin. The bootstrap reads each
	 * manager's dependencies from the registry and injects only those, so a
	 * manager never reaches the registry itself.
	 *
	 * @return Manager[] The plugin's managers.
	 */
	private function managers(): array {
		$schema = new SessionSchema(
			$this->registry->get( 'session.post_type' ),
			$this->registry->get( 'session.meta_prefix' )
		);

		// Course domain: the catalog describes the surf course and loads each
		// page's block markup; the router serves the WHOLE saved sequence —
		// bundled virtual pages and real user pages alike — off a single
		// opaque client index, through its own controlled synthetic-render
		// route (never a user page's real permalink, which is the security
		// boundary the surf engine relies on). No page data (ids, URLs,
		// titles, order, count) is ever emitted to the client.
		$catalog = new CourseCatalog( $this->paths->path( 'includes/Course/content' ) );

		// Post types the settings screen's browse pane may add a user page
		// from — the same list the sanitizer validates a saved user entry's
		// post type against.
		$settings_post_types = explode( ',', $this->registry->get( 'settings.post_types' ) );

		// Shared between the option's own definition (its sanitize + default
		// callbacks), the settings screen (which heals the saved order with
		// it on every read, since the sanitize callback only runs on write)
		// and the router (which reads the same order to resolve an
		// authorized index request).
		$order_sanitizer = new CourseOrderSanitizer( $catalog, $settings_post_types );

		// Describes the surf-course order option; registering it with
		// WordPress is OptionRegistry's job, not this provider's — see below.
		$course_order_option = new CourseOrderOption(
			$this->registry->get( 'settings.option' ),
			$order_sanitizer
		);

		return array(
			// Loads the plugin's PHP translations on `init` before any manager
			// hooked there renders a translatable string.
			new I18n(
				$this->registry->get( 'namespace' ),
				$this->plugin_file
			),
			// The plugin's one general options manager: registers every
			// `register_setting()`-backed option from its injected providers.
			// Adding a future option means adding a provider here, never a
			// new manager dedicated to a single option. The provider object
			// itself is injected, not its already-built definition: the
			// registry only calls `definition()` from inside its own `init`
			// callback, so a translatable string in a definition's args (e.g.
			// `CourseOrderOption`'s `description`) never runs `__()` before
			// `init`, which is composition time here.
			new OptionRegistry(
				array(
					$course_order_option,
				)
			),
			new SettingsScreen(
				$this->registry->get( 'admin_menu.slug' ),
				$this->registry->get( 'capability' ),
				$this->registry->get( 'admin_menu.icon' ),
				$this->registry->get( 'admin_menu.icon_style' ),
				$this->registry->get( 'settings.bundle' ),
				$this->registry->get( 'settings.style' ),
				$this->registry->get( 'settings.option' ),
				$settings_post_types,
				$order_sanitizer,
				$catalog,
				$this->assets,
				$this->registry->get( 'cockpit.param' ),
				$this->registry->get( 'cockpit.value' )
			),
			new SessionType(
				$schema,
				$this->registry->get( 'capability' )
			),
			new SessionRestQuery( $schema ),
			new SessionsScreen(
				$this->registry->get( 'admin_menu.slug' ),
				$this->registry->get( 'session.screen_slug' ),
				$this->registry->get( 'capability' ),
				$this->registry->get( 'session.bundle' ),
				$this->registry->get( 'session.style' ),
				$schema,
				$this->assets,
				$this->registry->get( 'cockpit.param' ),
				$this->registry->get( 'cockpit.value' )
			),
			// The "Start Benchmark" menu entry and admin bar node, both of
			// which jump straight to the cockpit dashboard in a new tab —
			// mirroring the Sessions screen's "Open Cockpit" link.
			new StartBenchmark(
				$this->registry->get( 'admin_menu.slug' ),
				$this->registry->get( 'admin_menu.start_slug' ),
				$this->registry->get( 'capability' ),
				$this->registry->get( 'cockpit.param' ),
				$this->registry->get( 'cockpit.value' ),
				$this->registry->get( 'admin_menu.nav_script' ),
				$this->registry->get( 'admin_menu.icon_style' ),
				new StartBenchmarkView(),
				$this->assets
			),
			new CourseRouter(
				$catalog,
				$this->registry->get( 'course.index_param' ),
				$this->registry->get( 'course.nonce_param' ),
				$this->registry->get( 'course.nonce_action' ),
				$this->registry->get( 'capability' ),
				$this->assets,
				$this->registry->get( 'course.style' ),
				$this->registry->get( 'course.script' ),
				$this->registry->get( 'course.body_class' ),
				$this->registry->get( 'settings.option' ),
				$order_sanitizer,
				new UserPageView()
			),
			new Cockpit(
				$this->paths->path( $this->registry->get( 'cockpit.block_dir' ) ),
				$this->registry->get( 'cockpit.block_name' ),
				$this->registry->get( 'cockpit.param' ),
				$this->registry->get( 'cockpit.value' ),
				$this->registry->get( 'capability' ),
				new CockpitDashboard(),
				$this->assets,
				$this->registry->get( 'session.post_type' ),
				$this->registry->get( 'course.nonce_action' ),
				new StandaloneChrome(
					$this->assets,
					$this->registry->get( 'cockpit.style' )
				)
			),
			// The session detail screen renders the summary postcard on each
			// session's native admin edit screen, replacing the editor. It reuses
			// the cockpit's view module (where the `bsb/cockpit` store is
			// registered) and the cockpit stylesheet (where the postcard styles
			// live), seeding the stored run onto the context.
			new SessionDetail(
				$this->registry->get( 'session.post_type' ),
				$this->registry->get( 'session.meta_prefix' ),
				$this->registry->get( 'capability' ),
				$this->registry->get( 'cockpit.block_name' ),
				$this->registry->get( 'session.screen_slug' ),
				$this->registry->get( 'cockpit.style' ),
				new SessionDetailView(),
				$this->assets
			),
			// Environment-gated dev tools: a floating panel (and the Interactivity
			// module it joins the cockpit store from) that lets battery behaviour be
			// forced for testing, active only in a development environment. Its own
			// gate closes registration entirely outside one, so nothing here reaches
			// a production site.
			new DevTools(
				explode( ',', $this->registry->get( 'devtools.environments' ) ),
				$this->registry->get( 'devtools.module' ),
				$this->registry->get( 'devtools.style' ),
				$this->assets,
				$this->registry->get( 'cockpit.param' ),
				$this->registry->get( 'cockpit.value' ),
				new DevToolsPanelView()
			),
		);
	}
}
