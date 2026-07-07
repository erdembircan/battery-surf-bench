/**
 * The cockpit's viewport load guard: recognizing whether the iframe actually
 * finished loading a real course page. Course pages are same-origin by
 * contract, and the course router marks every page it serves with a
 * `bsb-course-page` body class (see `CourseRouter::mark_course_body`); a 404, a
 * renamed/deleted slug, or any other page that isn't a served course page never
 * carries that marker. The router owns the marker rather than each page's own
 * content markup, so it is guaranteed regardless of what a page's blocks look
 * like. The store delegates its `load`/`error` decision to this pure module so
 * the detection itself stays unit-testable without a real iframe.
 */

/** Body-class marker the course router stamps on every page it serves. */
export const COURSE_PAGE_SELECTOR = '.bsb-course-page';

/**
 * Whether the framed document is the blank/reset state rather than a real
 * course-page navigation. The viewport binds its `src` to the store's
 * `currentSrc`, which is `''` while idle and again the moment a run stops; an
 * empty `src` frames `about:blank`, whose `load` event can fire *after* a run
 * has started (the browser resolves it asynchronously). That blank load is not
 * a failed course page and must be ignored, or it would immediately (and
 * wrongly) stop a run the instant it begins. A cross-origin frame throws on
 * access and is deliberately *not* treated as blank — that is a genuine
 * unexpected navigation the guard should catch.
 *
 * @param iframe                 The viewport iframe, or null if unresolved.
 * @param iframe.contentDocument The iframe's framed document, or null before it resolves.
 */
export const isBlankFrame = (
	iframe: { contentDocument: Document | null } | null
): boolean => {
	if ( iframe === null ) {
		return true;
	}

	let doc: Document | null;

	try {
		doc = iframe.contentDocument;
	} catch {
		return false;
	}

	// No document yet is as indeterminate as a blank reset — ignore it rather
	// than stopping a run on a frame that has not resolved to a real page.
	return doc === null || doc.URL === 'about:blank' || doc.URL === '';
};

/**
 * Whether an iframe's framed document is a real, loaded course page. Reading
 * `contentDocument` across a cross-origin frame throws a `SecurityError`; the
 * course pages are same-origin by contract, so a throw here means the frame
 * navigated somewhere unexpected, which is treated the same as "not a course
 * page" rather than propagating the exception.
 *
 * @param iframe                 The viewport iframe (or a fake carrying the same shape).
 * @param iframe.contentDocument The iframe's framed document, or null before it resolves.
 */
export const isCoursePageLoaded = ( iframe: {
	contentDocument: Document | null;
} ): boolean => {
	let doc: Document | null;

	try {
		doc = iframe.contentDocument;
	} catch {
		return false;
	}

	return doc !== null && doc.querySelector( COURSE_PAGE_SELECTOR ) !== null;
};

/**
 * Whether the viewport's `load`/`error` event means the current page failed to
 * load as a course page: an explicit `error` event, a missing iframe reference,
 * or a `load` that landed on a document without the course-page marker (a 404,
 * a renamed/deleted slug, or any other non-course page). The caller filters out
 * the blank/reset frame first ({@see isBlankFrame}), so a `load` reaching here
 * has resolved to a real navigation.
 *
 * @param event                  The iframe's `load` or `error` event.
 * @param event.type             The event's type, `'load'` or `'error'`.
 * @param iframe                 The viewport iframe the event fired on, or null if unresolved.
 * @param iframe.contentDocument The iframe's framed document, or null before it resolves.
 */
export const viewportFailed = (
	event: { type: string },
	iframe: { contentDocument: Document | null } | null
): boolean =>
	event.type === 'error' || iframe === null || ! isCoursePageLoaded( iframe );
