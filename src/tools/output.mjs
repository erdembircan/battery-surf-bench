// The output size of a build, shared by render.mjs and encode.mjs.
//   BSB_VIDEO_SCALE=1 (default) → 1920×1080: work/frames/, final/battery-surf-bench-spot-60s.mp4
//   BSB_VIDEO_SCALE=2           → 3840×2160: work/frames-4k/, final/battery-surf-bench-spot-60s-4k.mp4
// Scenes keep their 1920×1080 CSS layout at both sizes. Chromium draws them at the
// scale's device pixel ratio, so type and vector art stay sharp and the 2× plates
// show at their native resolution. The two builds keep separate frame folders and
// MP4 names, so neither overwrites the other's.
const raw = process.env.BSB_VIDEO_SCALE ?? '1';
if ( raw !== '1' && raw !== '2' ) {
	throw new Error( `BSB_VIDEO_SCALE must be 1 (1920×1080) or 2 (3840×2160), not "${ raw }"` );
}

export const SCALE = Number( raw );
export const WIDTH = 1920 * SCALE;
export const HEIGHT = 1080 * SCALE;
export const SUFFIX = SCALE === 2 ? '-4k' : '';
