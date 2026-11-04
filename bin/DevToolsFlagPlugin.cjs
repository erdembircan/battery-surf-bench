/**
 * Webpack plugin that defines the `BSB_DEV_TOOLS` build-time constant for the
 * code a config compiles: `true` in a development build, `false` in a
 * production build.
 *
 * It goes through the compiler's own `DefinePlugin`, so the build needs no
 * direct webpack import. The constant becomes a literal in the compiled code,
 * which lets a production build drop every branch it guards: the hooks the
 * cockpit and the surfer keep for the dev-tools panel (see
 * `src/BuildFlags.d.ts`).
 */
class DevToolsFlagPlugin {
	/**
	 * Stores whether the build includes the dev-tools panel.
	 *
	 * @param {boolean} devTools Whether the build includes the dev-tools panel.
	 */
	constructor( devTools ) {
		this.devTools = devTools;
	}

	/**
	 * Defines `BSB_DEV_TOOLS` for the code the compiler builds.
	 *
	 * @param {Object} compiler The webpack compiler.
	 */
	apply( compiler ) {
		new compiler.webpack.DefinePlugin( {
			BSB_DEV_TOOLS: JSON.stringify( this.devTools ),
		} ).apply( compiler );
	}
}

module.exports = DevToolsFlagPlugin;
