<?php
/**
 * Service-definition source.
 *
 * Returns the service-recipe map loaded into a {@see Definitions} container
 * at bootstrap. {@see Instantiator} consults a class's recipe — its
 * constructor argument specs and sharing behaviour — when building it, so
 * this file is the single source of how the plugin's managers and shared
 * building blocks are wired together. Sibling to `Config.php`, which is the
 * single source of the plugin's configuration values.
 *
 * @package ErdemBircan\BatterySurfBench
 */

namespace ErdemBircan\BatterySurfBench;

use ErdemBircan\BatterySurfBench\Admin\SessionsScreen;
use ErdemBircan\BatterySurfBench\Admin\SettingsScreen;
use ErdemBircan\BatterySurfBench\Admin\StartBenchmark;
use ErdemBircan\BatterySurfBench\Cockpit\Cockpit;
use ErdemBircan\BatterySurfBench\Content\SessionDetail;
use ErdemBircan\BatterySurfBench\Content\SessionRestQuery;
use ErdemBircan\BatterySurfBench\Content\SessionSchema;
use ErdemBircan\BatterySurfBench\Content\SessionType;
use ErdemBircan\BatterySurfBench\Course\CourseCatalog;
use ErdemBircan\BatterySurfBench\Course\CourseOrderOption;
use ErdemBircan\BatterySurfBench\Course\CourseOrderSanitizer;
use ErdemBircan\BatterySurfBench\Course\CourseRouter;
use ErdemBircan\BatterySurfBench\DevTools\DevTools;
use ErdemBircan\BatterySurfBench\Settings\OptionRegistry;
use ErdemBircan\BatterySurfBench\Support\Capability;
use ErdemBircan\BatterySurfBench\Support\StandaloneChrome;

defined( 'ABSPATH' ) || exit;

return array(

	// Shared building blocks (pulled in by autowiring).
	Paths::class                => array( 'args' => array( 'plugin_file' => array( 'runtime' => 'plugin_file' ) ) ),
	Assets::class               => array( 'args' => array( 'prefix' => '%namespace%' ) ),
	Capability::class           => array( 'args' => array( 'capability' => '%capability%' ) ),
	SessionSchema::class        => array(
		'args' => array(
			'post_type'   => '%session.post_type%',
			'meta_prefix' => '%session.meta_prefix%',
		),
	),
	CourseCatalog::class        => array( 'args' => array( 'content_dir' => array( 'path' => 'includes/Course/content' ) ) ),
	CourseOrderSanitizer::class => array(
		'args' => array(
			'selectable_post_types' => array( 'csv' => '%settings.post_types%' ),
		),
	),
	CourseOrderOption::class    => array( 'args' => array( 'option_name' => '%settings.option%' ) ),
	StandaloneChrome::class     => array( 'args' => array( 'style' => '%cockpit.style%' ) ),

	// Managers (the boot loop calls ->register() on each).
	I18n::class                 => array(
		'args' => array(
			'domain'      => '%namespace%',
			'plugin_file' => array( 'runtime' => 'plugin_file' ),
		),
	),
	OptionRegistry::class       => array(
		'args' => array(
			'providers' => array( 'services' => array( CourseOrderOption::class ) ),
		),
	),
	SettingsScreen::class       => array(
		'args' => array(
			'slug'                  => '%admin_menu.slug%',
			'capability'            => Capability::class,
			'icon_url'              => '%admin_menu.icon%',
			'icon_style'            => '%admin_menu.icon_style%',
			'bundle'                => '%settings.bundle%',
			'style'                 => '%settings.style%',
			'option_name'           => '%settings.option%',
			'selectable_post_types' => array( 'csv' => '%settings.post_types%' ),
			'cockpit_param'         => '%cockpit.param%',
			'cockpit_value'         => '%cockpit.value%',
		),
	),
	SessionType::class          => array( 'args' => array( 'capability' => Capability::class ) ),
	SessionRestQuery::class     => array(),
	SessionsScreen::class       => array(
		'args' => array(
			'parent_slug'   => '%admin_menu.slug%',
			'page_slug'     => '%session.screen_slug%',
			'capability'    => Capability::class,
			'bundle'        => '%session.bundle%',
			'style'         => '%session.style%',
			'cockpit_param' => '%cockpit.param%',
			'cockpit_value' => '%cockpit.value%',
		),
	),
	StartBenchmark::class       => array(
		'args' => array(
			'parent_slug'   => '%admin_menu.slug%',
			'page_slug'     => '%admin_menu.start_slug%',
			'capability'    => Capability::class,
			'cockpit_param' => '%cockpit.param%',
			'cockpit_value' => '%cockpit.value%',
			'nav_script'    => '%admin_menu.nav_script%',
			'menu_style'    => '%admin_menu.icon_style%',
		),
	),
	CourseRouter::class         => array(
		'args' => array(
			'index_param'  => '%course.index_param%',
			'nonce_param'  => '%course.nonce_param%',
			'nonce_action' => '%course.nonce_action%',
			'capability'   => Capability::class,
			'stylesheet'   => '%course.style%',
			'script'       => '%course.script%',
			'body_class'   => '%course.body_class%',
			'option_name'  => '%settings.option%',
		),
	),
	Cockpit::class              => array(
		'args' => array(
			'block_dir'         => array( 'path' => '%cockpit.block_dir%' ),
			'block_name'        => '%cockpit.block_name%',
			'param'             => '%cockpit.param%',
			'value'             => '%cockpit.value%',
			'capability'        => Capability::class,
			'session_post_type' => '%session.post_type%',
			'surf_nonce_action' => '%course.nonce_action%',
		),
	),
	SessionDetail::class        => array(
		'args' => array(
			'post_type'   => '%session.post_type%',
			'meta_prefix' => '%session.meta_prefix%',
			'capability'  => Capability::class,
			'block_name'  => '%cockpit.block_name%',
			'screen_slug' => '%session.screen_slug%',
			'style'       => '%cockpit.style%',
		),
	),
	DevTools::class             => array(
		'args' => array(
			'environments'  => array( 'csv' => '%devtools.environments%' ),
			'module'        => '%devtools.module%',
			'style'         => '%devtools.style%',
			'cockpit_param' => '%cockpit.param%',
			'cockpit_value' => '%cockpit.value%',
		),
	),

);
