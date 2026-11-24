/**
 * The seed the agent playground (`composer serve:agent`) boots with: pages to
 * try in the course, 24 benchmark runs spread over the last month, a saved
 * course, and an application password for the `admin` user.
 *
 * The runs are created through the plugin's own REST collection, the way the
 * cockpit saves a finished run, so what an agent reads back is what a real run
 * produces. They are chosen to give an agent something to find: measured and
 * unmeasured runs, every status and mode, three browsers on four operating
 * systems, one run (the last row) that started before the rows around it, and
 * a drain rate that is the fastest by a wide margin.
 */

/** A benchmark run the seed creates. */
export interface SeedRun {
	/** The row number, as it appears in the plan. */
	n: number;
	/** How many days before the boot the run started. */
	daysAgo: number;
	/** The stored lifecycle status. */
	status: 'finished' | 'stopped' | 'aborted' | 'failed';
	/** The stored run configuration mode. */
	configMode: 'duration' | 'targetDrop';
	/** The configured length in minutes, or the target battery percent for a target-drop run. */
	amount: number;
	/** How long the run lasted, in seconds. */
	elapsed: number;
	/** The battery level the run started at, as a fraction. */
	start: number;
	/** The battery level the run ended at, as a fraction. */
	end: number;
	/** The whole-run drain rate in percent per hour; zero when unmeasured. */
	rateSession: number;
	/** The drain rate over the last ten minutes; zero when unmeasured. */
	rate10: number;
	/** The projected full-battery runtime in seconds; zero when unmeasured. */
	tte: number;
	/** The browser name. */
	browser: string;
	/** The browser major version. */
	version: string;
	/** The operating system. */
	os: string;
}

/**
 * The 24 runs, one per line, inserted in this order. The last one started
 * earlier than the one before it on purpose, so the order of insertion is not
 * the order of start. Columns: row number, days ago, status, config mode,
 * minutes (or target percent), elapsed seconds, start level, end level,
 * session rate, ten-minute rate, projected seconds to empty, browser, version
 * and operating system.
 */
const SEED_TABLE = `
 1 | 29.2 | finished | duration   |  60 | 3600 | 0.98 | 0.88 | 10.0 | 10.4 | 36000 | Chrome | 142 | macOS
 2 | 27.5 | finished | duration   |  30 | 1800 | 0.91 | 0.86 |  9.5 |  9.8 | 37895 | Edge   | 141 | Windows
 3 | 26.1 | stopped  | duration   | 120 | 2460 | 0.80 | 0.73 | 10.2 | 11.0 | 35294 | Chrome | 142 | macOS
 4 | 24.0 | finished | targetDrop |  70 | 4320 | 0.85 | 0.70 | 12.5 | 12.9 | 28800 | Opera  | 124 | Windows
 5 | 22.3 | failed   | duration   |  60 |   95 | 0.77 | 0.77 |  0   |  0   |     0 | Chrome | 142 | Linux
 6 | 20.9 | finished | duration   |  45 | 2700 | 0.99 | 0.91 | 10.7 | 10.1 | 33645 | Edge   | 142 | Windows
 7 | 19.4 | aborted  | targetDrop |  50 | 1500 | 0.66 | 0.62 |  9.6 |  9.9 | 37500 | Chrome | 143 | macOS
 8 | 17.8 | finished | duration   |  15 |  900 | 0.95 | 0.94 |  0   |  0   |     0 | Chrome | 143 | macOS
 9 | 16.2 | finished | duration   |  90 | 5400 | 0.97 | 0.79 | 12.0 | 12.3 | 30000 | Edge   | 142 | Windows
10 | 14.6 | stopped  | targetDrop |  40 |  600 | 0.60 | 0.59 |  0   |  0   |     0 | Chrome | 143 | ChromeOS
11 | 13.1 | finished | duration   |  60 | 3600 | 0.92 | 0.82 |  9.8 | 10.6 | 36735 | Chrome | 143 | macOS
12 | 11.7 | failed   | targetDrop |  60 |   40 | 0.88 | 0.88 |  0   |  0   |     0 | Edge   | 142 | Windows
13 | 10.3 | finished | targetDrop |  75 | 3240 | 0.95 | 0.75 | 22.2 | 23.5 | 16216 | Chrome | 143 | Windows
14 |  9.0 | finished | duration   |  30 | 1800 | 0.70 | 0.65 | 10.0 | 10.0 | 36000 | Opera  | 125 | Windows
15 |  8.2 | aborted  | duration   |  60 | 1320 | 0.58 | 0.55 |  8.2 |  8.5 | 43902 | Edge   | 143 | Windows
16 |  7.4 | finished | duration   | 120 | 7200 | 0.99 | 0.77 | 11.0 | 11.4 | 32727 | Chrome | 143 | macOS
17 |  6.6 | stopped  | duration   |  60 | 1980 | 0.90 | 0.84 | 10.9 | 12.1 | 33028 | Chrome | 144 | macOS
18 |  5.3 | finished | targetDrop |  80 | 2880 | 0.96 | 0.80 | 20.0 | 19.4 | 18000 | Edge   | 143 | Windows
19 |  4.1 | failed   | duration   |  30 |  210 | 0.71 | 0.70 |  0   |  0   |     0 | Chrome | 144 | Linux
20 |  3.2 | finished | duration   |  60 | 3600 | 0.88 | 0.78 | 10.0 |  9.7 | 36000 | Chrome | 144 | macOS
21 |  2.0 | finished | duration   |  45 | 2700 | 0.93 | 0.85 | 10.7 | 11.3 | 33645 | Edge   | 144 | Windows
22 |  1.1 | aborted  | targetDrop |  60 |  900 | 0.74 | 0.72 |  8.0 |  8.0 | 45000 | Opera  | 125 | Windows
23 |  0.4 | finished | duration   |  30 | 1800 | 0.97 | 0.92 | 10.0 | 10.3 | 36000 | Chrome | 144 | macOS
24 | 12.4 | finished | duration   |  60 | 3600 | 0.89 | 0.79 | 10.0 | 10.2 | 36000 | Opera  | 124 | Windows
`;

/**
 * Parses {@link SEED_TABLE} into runs.
 *
 * @return The runs, in the table's order.
 */
const parseSeedTable = (): SeedRun[] =>
	SEED_TABLE.trim()
		.split( '\n' )
		.map( ( row ) => {
			const [
				n,
				daysAgo,
				status,
				configMode,
				amount,
				elapsed,
				start,
				end,
				rateSession,
				rate10,
				tte,
				browser,
				version,
				os,
			] = row.split( '|' ).map( ( cell ) => cell.trim() );

			return {
				n: Number( n ),
				daysAgo: Number( daysAgo ),
				status: status as SeedRun[ 'status' ],
				configMode: configMode as SeedRun[ 'configMode' ],
				amount: Number( amount ),
				elapsed: Number( elapsed ),
				start: Number( start ),
				end: Number( end ),
				rateSession: Number( rateSession ),
				rate10: Number( rate10 ),
				tte: Number( tte ),
				browser,
				version,
				os,
			};
		} );

/** The 24 runs the seed creates, in insertion order. */
export const seedRuns: readonly SeedRun[] = parseSeedTable();

/**
 * The PHP the agent blueprint runs once the plugin and the MCP Adapter are
 * active. It loads WordPress, signs in as `admin`, creates the pages, posts
 * and runs (through the plugin's REST collection, throwing on the first error
 * so a bad boot fails loudly), saves the course, and creates an application
 * password whose credentials it writes to `/agent/credentials.json` for
 * `StartAgent.mts` to print. Raw PHP file writes are fine here: this is
 * dev-only Playground code, not plugin code.
 */
export const agentSeedPhp = String.raw`<?php
require_once '/wordpress/wp-load.php';

$bsb_admin = get_user_by( 'login', 'admin' );
if ( ! $bsb_admin ) {
	throw new RuntimeException( 'The admin user is missing.' );
}
wp_set_current_user( $bsb_admin->ID );

$bsb_placeholder = '<!-- wp:paragraph --><p>Placeholder content for the agent playground.</p><!-- /wp:paragraph -->';

function bsb_seed_post( $args ) {
	global $bsb_placeholder;
	$id = wp_insert_post( array_merge( array( 'post_content' => $bsb_placeholder ), $args ), true );
	if ( is_wp_error( $id ) ) {
		throw new RuntimeException( $id->get_error_message() );
	}
	return $id;
}

bsb_seed_post( array( 'post_type' => 'page', 'post_title' => 'About', 'post_status' => 'publish' ) );
$bsb_contact = bsb_seed_post( array( 'post_type' => 'page', 'post_title' => 'Contact', 'post_status' => 'publish' ) );
bsb_seed_post( array( 'post_type' => 'page', 'post_title' => 'Pricing', 'post_status' => 'draft' ) );
bsb_seed_post( array( 'post_type' => 'page', 'post_title' => 'Team Notes', 'post_status' => 'private' ) );
bsb_seed_post( array( 'post_type' => 'post', 'post_title' => 'Battery Myths, Busted', 'post_status' => 'publish' ) );
bsb_seed_post(
	array(
		'post_type'     => 'post',
		'post_title'    => 'Coming Soon: Our Spring Tour',
		'post_status'   => 'future',
		'post_date'     => wp_date( 'Y-m-d H:i:s', time() + 10 * DAY_IN_SECONDS ),
		'post_date_gmt' => gmdate( 'Y-m-d H:i:s', time() + 10 * DAY_IN_SECONDS ),
	)
);

/**
 * Builds a run's run-length-encoded sample log: one plateau per whole percent
 * from the start level down to the end level, spread evenly over the run.
 */
function bsb_seed_samples( $row ) {
	$drop = (int) round( ( $row['start'] - $row['end'] ) * 100 );
	$ms   = $row['elapsed'] * 1000;

	if ( 0 === $drop ) {
		return array(
			array( 't' => 0, 'level' => $row['start'], 'charging' => false, 'count' => 2 ),
			array( 't' => $ms, 'level' => $row['start'], 'charging' => false, 'count' => 1 ),
		);
	}

	$samples = array();
	for ( $k = 0; $k <= $drop; $k++ ) {
		$samples[] = array(
			't'        => (int) round( $k * $ms / max( $drop, 1 ) ),
			'level'    => round( $row['start'] - $k / 100, 2 ),
			'charging' => false,
			'count'    => 3,
		);
	}
	if ( 'aborted' === $row['status'] ) {
		$samples[] = array( 't' => $ms, 'level' => $row['end'], 'charging' => true, 'count' => 1 );
	}
	return $samples;
}

$bsb_rows = json_decode( '__ROWS__', true );
$bsb_now  = time();

foreach ( $bsb_rows as $row ) {
	$start = $bsb_now - (int) round( $row['daysAgo'] * DAY_IN_SECONDS );
	$start = $start - ( $start % 60 );
	$end   = $start + $row['elapsed'];

	$meta = array(
		'bsbench_status'        => $row['status'],
		'bsbench_mode'          => 'targetDrop' === $row['configMode'] ? 'target' : 'duration',
		'bsbench_config_mode'   => $row['configMode'],
		'bsbench_started_at'    => gmdate( 'Y-m-d\TH:i:s.000\Z', $start ),
		'bsbench_ended_at'      => gmdate( 'Y-m-d\TH:i:s.000\Z', $end ),
		'bsbench_start_level'   => (float) $row['start'],
		'bsbench_end_level'     => (float) $row['end'],
		'bsbench_dropped_pct'   => round( ( $row['start'] - $row['end'] ) * 100, 2 ),
		'bsbench_elapsed'       => (int) $row['elapsed'],
		'bsbench_rate_session'  => (float) $row['rateSession'],
		'bsbench_rate_10'       => (float) $row['rate10'],
		'bsbench_time_to_empty' => (int) $row['tte'],
		'bsbench_ua_browser'    => $row['browser'],
		'bsbench_ua_version'    => $row['version'],
		'bsbench_ua_os'         => $row['os'],
		'bsbench_samples'       => bsb_seed_samples( $row ),
	);
	if ( 'duration' === $row['configMode'] ) {
		$meta['bsbench_config_duration'] = (int) $row['amount'] * 60;
	} else {
		$meta['bsbench_config_target_percent'] = (int) $row['amount'];
	}

	$request = new WP_REST_Request( 'POST', '/wp/v2/bsbench_session' );
	$request->set_header( 'Content-Type', 'application/json' );
	$request->set_body(
		wp_json_encode(
			array(
				'status'   => 'publish',
				'date_gmt' => gmdate( 'Y-m-d\TH:i:s', $end ),
				'meta'     => $meta,
			)
		)
	);
	$response = rest_do_request( $request );
	if ( $response->is_error() ) {
		throw new RuntimeException( $response->as_error()->get_error_message() );
	}
}

update_option(
	'bsbench_course_order',
	array(
		array( 'kind' => 'bundled', 'slug' => 'article-1' ),
		array( 'kind' => 'bundled', 'slug' => 'gallery' ),
		array( 'kind' => 'bundled', 'slug' => 'article-2' ),
		array( 'kind' => 'bundled', 'slug' => 'video' ),
		array( 'kind' => 'bundled', 'slug' => 'links' ),
		array( 'kind' => 'user', 'id' => $bsb_contact ),
	)
);

$bsb_created = WP_Application_Passwords::create_new_application_password( $bsb_admin->ID, array( 'name' => 'Agent playground' ) );
if ( is_wp_error( $bsb_created ) ) {
	throw new RuntimeException( $bsb_created->get_error_message() );
}
file_put_contents( '/agent/credentials.json', json_encode( array( 'username' => 'admin', 'password' => $bsb_created[0] ) ) );
`.replace( '__ROWS__', JSON.stringify( seedRuns ) );
