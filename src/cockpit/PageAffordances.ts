/**
 * The dev-tools panel's side of the sterile engine's page-affordances
 * handshake: recognizing the `postMessage` a `SterileHelm` sends once, right
 * after it senses the freshly-loaded page, and reading the affordance flags
 * it carries. Lives alongside `./BehaviorStart`/`./BehaviorEnd` even though
 * its only consumer is `../devtools/SurfSteerStore` — the panel already
 * imports cockpit-owned modules (e.g. `./Format`), and this keeps every
 * iframe↔cockpit message's protocol code in one place.
 */

/** The affordance flags a sterile page-affordances message carries. */
export interface PageAffordancesPayload {
	hasVideo: boolean;
	imageCount: number;
	textDensity: number;
}

/** The message type the sterile engine posts once it has sensed the loaded page. */
export const PAGE_AFFORDANCES_TYPE = 'bsb:pageAffordances';

/**
 * Narrows an unknown value to a well-formed {@link PageAffordancesPayload}.
 * @param value
 */
const isPayload = ( value: unknown ): value is PageAffordancesPayload => {
	if ( typeof value !== 'object' || value === null ) {
		return false;
	}

	const { hasVideo, imageCount, textDensity } = value as Record<
		string,
		unknown
	>;

	return (
		typeof hasVideo === 'boolean' &&
		typeof imageCount === 'number' &&
		typeof textDensity === 'number'
	);
};

/**
 * Whether a `message` event is a legitimate page-affordances signal from the
 * surf engine running in the viewport iframe: same-origin (the iframe only
 * ever loads the plugin's own course pages) and carrying a well-formed
 * affordances payload.
 * @param event
 * @param expectedOrigin
 */
export const isPageAffordancesMessage = (
	event: MessageEvent,
	expectedOrigin: string
): boolean => {
	if ( event.origin !== expectedOrigin ) {
		return false;
	}

	const data = event.data as { type?: unknown; affordances?: unknown } | null;

	return (
		data?.type === PAGE_AFFORDANCES_TYPE && isPayload( data.affordances )
	);
};

/**
 * The affordance flags a page-affordances message carries. Only called after
 * {@link isPageAffordancesMessage} has already verified the shape.
 * @param event
 */
export const affordancesOf = ( event: MessageEvent ): PageAffordancesPayload =>
	( event.data as { affordances: PageAffordancesPayload } ).affordances;
