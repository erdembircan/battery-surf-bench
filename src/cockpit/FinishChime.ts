/**
 * Finish chime for the cockpit deck.
 *
 * A run that ends on its own terms — the duration elapsed, or the target battery
 * drop was reached — sounds a short chime so a benchmark left unattended can
 * call for attention. A manual stop or a charger interrupt stays silent. The
 * deck offers a single toggle to mute or sound it, remembered across visits.
 *
 * No audio asset ships: there is no chime sound built into browsers to rely on,
 * so the tone is synthesised with the Web Audio API. This module owns that
 * synthesis and the on/off preference; the cockpit store wires the toggle and
 * plays the chime at a natural finish. The platform audio plumbing is injected
 * (a context factory) so the synthesis can be unit-tested without Web Audio.
 */

/** localStorage key the finish-sound preference is remembered under. */
export const SOUND_KEY = 'bsbench-cockpit-sound';

/** The chime's notes (Hz) — a bright A major triad: A5, C#6, E6. */
const NOTES = [ 880, 1108.73, 1318.51 ];

/** Seconds between the onset of each note, so the triad arpeggiates. */
const STAGGER = 0.12;

/** Peak gain each note rises to. */
const PEAK = 0.22;

/** Seconds to rise from silence to peak — a soft attack, no click. */
const ATTACK = 0.02;

/** Seconds for a note to decay back toward silence. */
const DECAY = 0.45;

/** Near-zero gain the decay targets (an exponential ramp cannot reach 0). */
const FLOOR = 0.0001;

/** Minimal shape of a Web Audio parameter the envelope drives. */
interface AudioParamLike {
	setValueAtTime: ( value: number, when: number ) => void;
	linearRampToValueAtTime: ( value: number, when: number ) => void;
	exponentialRampToValueAtTime: ( value: number, when: number ) => void;
}

/** Minimal shape of a connectable Web Audio node. */
interface AudioNodeLike {
	connect: ( destination: AudioNodeLike ) => AudioNodeLike;
}

/** Minimal shape of the oscillator the chime drives. */
interface OscillatorLike extends AudioNodeLike {
	type: string;
	frequency: { value: number };
	start: ( when: number ) => void;
	stop: ( when: number ) => void;
}

/** Minimal shape of the gain node shaping a note's envelope. */
interface GainLike extends AudioNodeLike {
	gain: AudioParamLike;
}

/** Minimal shape of the audio context the chime needs. */
export interface AudioContextLike {
	readonly currentTime: number;
	readonly state: string;
	readonly destination: AudioNodeLike;
	resume: () => unknown;
	createOscillator: () => OscillatorLike;
	createGain: () => GainLike;
}

/** A constructor yielding an audio context (the platform `AudioContext`). */
export type AudioContextCtor = new () => AudioContextLike;

/**
 * The platform audio-context constructor, or null where Web Audio is absent
 * (older Safari exposes it prefixed). Lets the store skip building a chime it
 * could never sound, leaving finishes silent rather than erroring.
 */
export const audioContextCtor = (): AudioContextCtor | null => {
	const scope = window as typeof window & {
		webkitAudioContext?: AudioContextCtor;
	};

	return (
		( window.AudioContext as unknown as AudioContextCtor | undefined ) ??
		scope.webkitAudioContext ??
		null
	);
};

/**
 * The remembered finish-sound preference. On by default — only an explicit
 * "off" silences it — so a first-time, unattended run still calls for attention;
 * returns on where storage is unavailable (private mode).
 */
export const readStoredSound = (): boolean => {
	try {
		return window.localStorage.getItem( SOUND_KEY ) !== 'off';
	} catch {
		return true;
	}
};

/**
 * Remembers the finish-sound choice across visits, silently tolerating
 * unavailable storage (the choice still applies for the current session).
 * @param enabled
 */
export const writeStoredSound = ( enabled: boolean ): void => {
	try {
		window.localStorage.setItem( SOUND_KEY, enabled ? 'on' : 'off' );
	} catch {
		// Storage unavailable (private mode); the choice still applies for this
		// session.
	}
};

/**
 * The finish chime: a lazily-built, gesture-unlocked audio context that sounds a
 * short arpeggiated triad. Browsers block audio until a user gesture, so the
 * context is created and resumed under a gesture — `prime()` from the Start
 * click, or `play()` from the toggle — leaving the later, gesture-less finish
 * free to sound.
 */
export class FinishChime {
	/** The lazily-built audio context, or null until first primed/played. */
	private context: AudioContextLike | null = null;

	/**
	 * @param make Builds a fresh audio context; deferred so none is created
	 *             before a user gesture, and injectable for tests.
	 */
	constructor( private readonly make: () => AudioContextLike ) {}

	/**
	 * Builds (once) and resumes the audio context without sounding anything, so
	 * a later finish can play without its own gesture. Called under the Start
	 * click, which is that gesture.
	 */
	prime(): void {
		this.ready();
	}

	/** Sounds the chime — the arpeggiated triad — building the context if needed. */
	play(): void {
		const context = this.ready();
		const start = context.currentTime;

		NOTES.forEach( ( frequency, index ) => {
			const at = start + index * STAGGER;
			const oscillator = context.createOscillator();
			const gain = context.createGain();

			oscillator.type = 'sine';
			oscillator.frequency.value = frequency;

			gain.gain.setValueAtTime( 0, at );
			gain.gain.linearRampToValueAtTime( PEAK, at + ATTACK );
			gain.gain.exponentialRampToValueAtTime( FLOOR, at + DECAY );

			oscillator.connect( gain ).connect( context.destination );
			oscillator.start( at );
			oscillator.stop( at + DECAY + 0.05 );
		} );
	}

	/** The audio context, built on first use and resumed if the browser suspended it. */
	private ready(): AudioContextLike {
		if ( ! this.context ) {
			this.context = this.make();
		}

		if ( this.context.state === 'suspended' ) {
			void this.context.resume();
		}

		return this.context;
	}
}
