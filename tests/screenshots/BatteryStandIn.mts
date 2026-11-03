/**
 * A scripted stand-in for the Battery Status API, installed into the cockpit
 * page before its scripts run, so the listing's live-run screenshot shows
 * readouts the cockpit computed itself from a realistic discharge.
 *
 * The stand-in reports an unplugged battery that starts at 87 % and drops
 * 1 % at a time on a fixed schedule averaging about 16 % an hour, firing
 * `levelchange` like the real API. It runs on the page's real clock, so the
 * cockpit's own loop and math see real elapsed time: three steps take a
 * little over 11 minutes.
 */

export const STAND_IN_START_LEVEL = 0.87;

export const STAND_IN_STEPS_MS: readonly number[] = [
	214_000, 236_000, 221_000, 229_000, 218_000, 232_000, 224_000, 226_000,
];

export interface StandInStep {
	atMs: number;
	level: number;
}

/**
 * Lays out the stand-in's discharge: one entry per 1 % step, with the time it
 * happens at and the battery level it reports.
 *
 * @param startLevel - The battery level the run starts at, from 0 to 1.
 * @param stepsMs    - How long each successive 1 % step takes; cycled when `count` exceeds its length.
 * @param count      - How many steps to schedule.
 * @return The steps in order, each at the running sum of the step durations.
 */
export function standInSchedule(
	startLevel: number,
	stepsMs: readonly number[],
	count: number
): StandInStep[] {
	const startPercent = Math.round( startLevel * 100 );
	const schedule: StandInStep[] = [];
	let atMs = 0;

	for ( let index = 0; index < count; index++ ) {
		atMs += stepsMs[ index % stepsMs.length ];
		schedule.push( {
			atMs,
			level: ( startPercent - ( index + 1 ) ) / 100,
		} );
	}

	return schedule;
}

/**
 * Installs the scripted battery into the page: `navigator.getBattery()` then
 * resolves a battery that starts at `startLevel` and fires `levelchange` at
 * each scheduled time. Runs inside the page via `page.addInitScript`, so it
 * is self-contained and touches only the top frame.
 *
 * @param options            - The stand-in's script.
 * @param options.startLevel - The battery level to report until the first step.
 * @param options.schedule   - The steps to play, as laid out by {@link standInSchedule}.
 */
export function installBatteryStandIn( {
	startLevel,
	schedule,
}: {
	startLevel: number;
	schedule: StandInStep[];
} ): void {
	if ( window.top !== window ) {
		return;
	}

	class StandInBattery extends EventTarget {
		level = startLevel;
		charging = false;
		chargingTime = Infinity;
		dischargingTime = Infinity;
		onlevelchange = null;
		onchargingchange = null;
		onchargingtimechange = null;
		ondischargingtimechange = null;
	}

	const battery = new StandInBattery();

	for ( const step of schedule ) {
		setTimeout( () => {
			battery.level = step.level;
			battery.dispatchEvent( new Event( 'levelchange' ) );
		}, step.atMs );
	}

	Object.defineProperty( Navigator.prototype, 'getBattery', {
		configurable: true,
		value: () => Promise.resolve( battery ),
	} );
}
