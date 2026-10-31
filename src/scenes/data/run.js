/* Numbers shown in the spot, read from the captured cockpit plates: a run on a
   scripted 1 % battery staircase (≈14 %/h), measured by the plugin's own run
   loop and least-squares math. Scenes must read from window.RUN, never hard-code. */
window.RUN = {
	provisional: false,
	battery: 84, // plate A
	batteryNext: 83, // plate B, after the live 1 % tick
	rate10: 13.0, // RATE · 10 MIN after the tick (13.5 before)
	rateSession: 13.9, // RATE · SESSION after the tick (14.3 before)
	fullDrain: '7:11', // "100% → 0%" after the tick (7:00 before)
	staircase: [ 88, 87, 86, 85, 84, 83 ], // 1 % steps, ~4 min apart
};
