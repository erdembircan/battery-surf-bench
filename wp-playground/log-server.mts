import { styleText } from 'node:util';

interface ServerInfo {
	url: string;
	mode: 'persistent' | 'non-persistent';
	phpmyadminPath?: string;
}

/** Raw data for a single info line before formatting. */
interface LineData {
	label: string;
	value: string;
	valueStyle: Parameters< typeof styleText >[ 0 ];
}

/**
 * Format a bold white label string.
 *
 * @param text - The label text.
 * @return Styled label string.
 */
function label( text: string ): string {
	return styleText( [ 'bold', 'white' ], text );
}

/**
 * Render a single info line with column-aligned label, separator, and value.
 *
 * @param arrow     - Styled arrow prefix.
 * @param data      - Line data containing label, value, and style.
 * @param colWidth  - Column width to pad labels to.
 * @param separator - Separator between label and value columns.
 * @return Formatted line string.
 */
function line(
	arrow: string,
	data: LineData,
	colWidth: number,
	separator = ':'
): string {
	const paddedLabel = data.label.padEnd( colWidth );
	return `  ${ arrow }  ${ label( paddedLabel ) } ${ separator } ${ styleText(
		data.valueStyle,
		data.value
	) }`;
}

/**
 * Print a styled server-ready banner to the terminal.
 *
 * @param info                - Server connection details.
 * @param info.url            - The local server URL.
 * @param info.mode           - Whether the instance is persistent or non-persistent.
 * @param info.phpmyadminPath - Optional phpMyAdmin URL path.
 */
export function logServerReady( {
	url,
	mode,
	phpmyadminPath,
}: ServerInfo ): void {
	const header = styleText( [ 'bold', 'magenta' ], '⚡ Playground' );
	const arrow = styleText( 'magenta', '➜' );

	const items: LineData[] = [
		{ label: 'Local', value: url, valueStyle: 'cyan' },
		{ label: 'Mode', value: mode, valueStyle: 'yellow' },
	];

	if ( phpmyadminPath ) {
		items.push( {
			label: 'phpMyAdmin',
			value: `${ url }${ phpmyadminPath }`,
			valueStyle: 'cyan',
		} );
	}

	const colWidth = Math.max( ...items.map( ( item ) => item.label.length ) );
	const lines = items.map( ( item ) => line( arrow, item, colWidth ) );

	process.stdout.write( `
  ${ header }

${ lines.join( '\n' ) }

` );
}
