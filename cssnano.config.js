/**
 * cssnano configuration for the production CSS build.
 *
 * `wp-scripts build` minifies every stylesheet with cssnano, and only then
 * does its RtlCssPlugin write the mirrored `-rtl.css` twin. Without a project
 * config, wp-scripts falls back to a preset that removes every comment, so
 * rtlcss never sees the control directives that keep a rule from being
 * mirrored. With this file present, wp-scripts defers to it, and cssnano
 * finds it from the project root.
 *
 * Only rtlcss directives survive; every other comment is still removed. Write
 * them as loud comments (opened with `/*!`), because Sass's compressed output
 * drops plain comments before cssnano runs. rtlcss strips the directives from
 * the `-rtl.css` twin, but the left-to-right stylesheet keeps them: nothing
 * minifies after this step, and they are inert there.
 *
 * Three optimizations stay off because they move declarations or merge rules,
 * which would separate a directive from the declaration or rule it governs.
 * They cost almost nothing: the minified stylesheets grow by well under one
 * percent, and gzip sizes stay about the same.
 */

/**
 * Matches an rtlcss control directive, with or without the leading `!` of a
 * loud comment. It is the same pattern rtlcss uses to recognize directives.
 */
const RTL_DIRECTIVE = /^\s*!?\s*rtl:/;

/**
 * Decides whether cssnano may drop a comment: every comment goes except
 * rtlcss directives.
 *
 * @param {string} comment The comment's text, without its delimiters.
 * @return {boolean} Whether cssnano should remove the comment.
 */
function isRemovableComment( comment ) {
	return ! RTL_DIRECTIVE.test( comment );
}

module.exports = {
	preset: [
		'default',
		{
			discardComments: { remove: isRemovableComment },
			cssDeclarationSorter: false,
			mergeRules: false,
			mergeLonghand: false,
		},
	],
};
