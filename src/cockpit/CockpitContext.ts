/**
 * Shared types for the `bsb/cockpit` Interactivity store — the per-instance
 * reactive context the block's PHP render seeds, and the supporting shapes the
 * store's domain slices read from and write to it.
 */

import { type RunMode } from './RunConfig';
import { type Sample } from './DrainRate';

/** One surfable course page, as supplied by the `bsb/course-pages` binding. */
export interface CoursePage {
	slug: string;
	title: string;
	url: string;
}

/** Why a run ended — drives the summary's verdict; empty before any run ends. */
export type RunEndReason =
	| ''
	| 'duration'
	| 'targetDrop'
	| 'stopped'
	| 'plugged';

/** Which kind of toast is showing — an upload error or the view-only notice. */
export type ToastKind = 'error' | 'notice';

/** The toast pill's animation phase; empty when no toast is showing. */
export type ToastPhase = '' | 'entering' | 'holding' | 'leaving';

/** The translated wording shown on the summary for a given end reason. */
export interface ReasonText {
	/** Handwritten verdict heading, e.g. "The run is in.". */
	head: string;
	/** One-line signature under the heading, e.g. "Ran the full 30 minutes.". */
	sig: string;
	/** The postmark's lower curved label, e.g. "· COMPLETED ·". */
	arc: string;
	/** The postmark's centre unit label, e.g. "MIN RUN" / "REACHED" / "ELAPSED". */
	unit: string;
}

/** Per-instance context the cockpit's PHP render seeds onto the block. */
export interface CockpitContext {
	pages: CoursePage[];
	activeIndex: number;
	mode: RunMode;
	durationMinutes: number;
	speed: number;
	// The surfer personality: a six-stat trait vector (see shared/SurferStats),
	// whether the stat sliders are revealed, and the translated archetype names
	// keyed by canonical key so the store can show the derived cover-name.
	traits: number[];
	traitsOpen: boolean;
	archetypeLabels: Record< string, string >;
	running: boolean;
	compact: boolean;
	soundEnabled: boolean;
	elapsed: number;
	targetPercent: number;
	batteryLevel: number | null;
	batteryCharging: boolean;
	// Whether the Battery Status API is present. Seeded true and set false on
	// hydration where the browser lacks the API (Safari, Firefox): a benchmark
	// has no battery data to measure, so the cockpit locks and the startup
	// postcard's back turns to the unsupported warning.
	batterySupported: boolean;
	rate10: number | null;
	rateSession: number | null;
	secondsToEmpty: number | null;
	ended: boolean;
	endReason: RunEndReason;
	flipped: boolean;
	idleFlipped: boolean;
	reasonText: Record< string, ReasonText >;
	// Frozen summary readouts, stored on the context (reactive) at run end so the
	// summary re-renders — the session log they derive from is not a signal.
	summaryBatteryStart: string;
	summaryBatteryEnd: string;
	summaryDropped: string;
	hasGraph: boolean;
	// The drain-graph draw model, serialised so it lands in reactive context; the
	// summary painter parses it back to redraw the chart.
	graphJson: string;
	// The toast pill: the kind on screen (empty when none), its resolved message,
	// and its animation phase. The pending queue lives off-context in the
	// per-instance state; only the one showing rides the reactive context.
	toastKind: ToastKind | '';
	toastText: string;
	toastPhase: ToastPhase;
	// Translated toast messages by kind, seeded by the server so the strings stay
	// localizable; the queue resolves the current message from here.
	toastStrings: Record< ToastKind, string >;
	// The behavior-start bark: the behavior key showing (empty when none), its
	// resolved flavor text, and its animation phase. The pending slot lives
	// off-context in the per-instance state; only the one showing rides the
	// reactive context.
	barkBehavior: string;
	barkText: string;
	barkPhase: ToastPhase;
	// Translated bark quips by behavior key, two variants each; the cockpit
	// picks one at random when the behavior starts. A behavior key absent here
	// never barks (the mechanical, frequent behaviors have no entry).
	barkStrings: Record< string, string[] >;
	// The stored run's samples, seeded by the session detail page so its summary
	// can rebuild the drain graph client-side (the chart geometry is TS, so the
	// server cannot precompute it). Absent in the live cockpit, which builds the
	// graph from its own run log at run end.
	detailSamples?: Sample[];
}
