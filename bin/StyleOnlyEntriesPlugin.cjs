/**
 * Webpack plugin that removes the scripts webpack writes for stylesheet-only
 * entries.
 *
 * Webpack emits a JavaScript bundle for every entry, and `@wordpress/scripts`'
 * dependency extraction writes an `.asset.php` file beside it, even when the
 * entry is a single stylesheet. The plugin loads only those entries'
 * stylesheets, so after the dependency extraction has run, this deletes the
 * bundle and asset file of every entry whose entry modules are all
 * stylesheets, and only the stylesheets reach `build/`.
 */
class StyleOnlyEntriesPlugin {
	/**
	 * Hooks into every compilation, at a stage after the dependency
	 * extraction writes its asset files.
	 *
	 * @param {Object} compiler The webpack compiler.
	 */
	apply( compiler ) {
		const { Compilation } = compiler.webpack;

		compiler.hooks.thisCompilation.tap(
			'StyleOnlyEntriesPlugin',
			( compilation ) => {
				compilation.hooks.processAssets.tap(
					{
						name: 'StyleOnlyEntriesPlugin',
						stage: Compilation.PROCESS_ASSETS_STAGE_REPORT,
					},
					() => {
						for ( const [ name, entry ] of compilation.entries ) {
							if ( isStyleOnly( entry ) ) {
								compilation.deleteAsset( `${ name }.js` );
								compilation.deleteAsset(
									`${ name }.asset.php`
								);
							}
						}
					}
				);
			}
		);
	}
}

/**
 * Tells whether every module an entry starts from is a stylesheet.
 *
 * @param {Object} entry A compilation entry, with the dependencies it starts from.
 * @return {boolean} Whether the entry has modules and all of them are `.css`, `.scss` or `.sass` files.
 */
function isStyleOnly( entry ) {
	const requests = entry.dependencies.map(
		( dependency ) => dependency.request
	);

	return (
		requests.length > 0 &&
		requests.every( ( request ) => /\.(?:css|scss|sass)$/.test( request ) )
	);
}

module.exports = StyleOnlyEntriesPlugin;
