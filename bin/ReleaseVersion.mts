/**
 * The version check behind `pnpm release:version`: a WordPress.org release only
 * reaches sites when three version strings agree. The plugin header's `Version:`
 * is what a site sees as installed, `readme.txt`'s `Stable tag:` names the SVN
 * tag WordPress.org serves, and the git tag becomes that SVN tag. A release
 * whose tag or stable tag differs from the header ships a version no site is
 * offered, or offers an update that never installs, so the deploy stops first.
 *
 * Every check reads only the files' contents, so it is testable without a
 * filesystem; `VerifyRelease.mts` reads the files.
 */

/**
 * Reads a `Name: value` header field, the format both the plugin header and the
 * readme header use.
 *
 * @param source - The file contents.
 * @param field  - The field name, such as `Version`.
 * @return The trimmed value, or null when the field is missing or empty.
 */
function headerField( source: string, field: string ): string | null {
	const escaped = field.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
	const match = new RegExp(
		`^[\\s*#@/]*${ escaped }:[ \\t]*(\\S.*?)[ \\t]*$`,
		'im'
	).exec( source );

	return match ? match[ 1 ] : null;
}

/**
 * Checks that the plugin header, the readme and, when given, the git tag name
 * the same release version.
 *
 * @param pluginFile - The main plugin file's contents.
 * @param readme     - The `readme.txt` contents.
 * @param tag        - The git tag being released, or null for a run without one, such as a manual dry run.
 * @return The release version, or the list of problems when the versions disagree or are missing.
 */
export function findReleaseVersion(
	pluginFile: string,
	readme: string,
	tag: string | null
): { version: string } | { errors: string[] } {
	const version = headerField( pluginFile, 'Version' );
	const stableTag = headerField( readme, 'Stable tag' );
	const errors: string[] = [];

	if ( version === null ) {
		errors.push(
			'The plugin header has no "Version:" field, so there is no version to release.'
		);
	}

	if ( stableTag === null ) {
		errors.push(
			'readme.txt has no "Stable tag:" field, so WordPress.org would not know which tag to serve.'
		);
	}

	if ( version !== null && stableTag !== null && stableTag !== version ) {
		errors.push(
			`readme.txt's "Stable tag: ${ stableTag }" differs from the plugin header's "Version: ${ version }": WordPress.org would keep serving ${ stableTag }.`
		);
	}

	if ( version !== null && tag !== null && tag !== version ) {
		errors.push(
			`The tag "${ tag }" differs from the plugin header's "Version: ${ version }": tag each release with its bare version, such as ${ version }.`
		);
	}

	return errors.length > 0 || version === null ? { errors } : { version };
}
