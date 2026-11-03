import type { Motor } from '@/surfer/Motor';

/** One motion command a {@link FakeMotor} recorded. */
export interface RecordedCommand {
	kind:
		| 'scrollBy'
		| 'pointerDrift'
		| 'selectSnippet'
		| 'playVideo'
		| 'stopVideo'
		| 'lingerImage'
		| 'read'
		| 'idle';
	args: readonly number[];
}

/**
 * What {@link FakeMotor}'s `selectSnippet` reports through `onPlanned` unless
 * a test says otherwise — an arbitrary stand-in for the length-derived
 * duration `DomMotor` plans.
 */
export const FAKE_SNIPPET_PLAN_MS = 2400;

/**
 * Test double for {@link Motor}: never touches the DOM, just records every
 * command it was asked to perform so a test can assert on the sequence and
 * arguments without a real browser.
 */
export class FakeMotor implements Motor {
	readonly commands: RecordedCommand[] = [];

	private readonly snippetPlanMs: number | null;

	/**
	 * Sets what `selectSnippet` reports through `onPlanned` — or null to mimic
	 * a page with nothing to select, where it never fires.
	 * @param snippetPlanMs
	 */
	constructor( snippetPlanMs: number | null = FAKE_SNIPPET_PLAN_MS ) {
		this.snippetPlanMs = snippetPlanMs;
	}

	scrollBy( px: number, ms: number ): Promise< void > {
		this.commands.push( { kind: 'scrollBy', args: [ px, ms ] } );
		return Promise.resolve();
	}

	pointerDrift( ms: number ): Promise< void > {
		this.commands.push( { kind: 'pointerDrift', args: [ ms ] } );
		return Promise.resolve();
	}

	selectSnippet(
		onPlanned?: ( durationMs: number ) => void
	): Promise< void > {
		this.commands.push( { kind: 'selectSnippet', args: [] } );

		if ( this.snippetPlanMs !== null ) {
			onPlanned?.( this.snippetPlanMs );
		}

		return Promise.resolve();
	}

	playVideo(): Promise< void > {
		this.commands.push( { kind: 'playVideo', args: [] } );
		return Promise.resolve();
	}

	stopVideo(): Promise< void > {
		this.commands.push( { kind: 'stopVideo', args: [] } );
		return Promise.resolve();
	}

	lingerImage( ms: number ): Promise< void > {
		this.commands.push( { kind: 'lingerImage', args: [ ms ] } );
		return Promise.resolve();
	}

	read( ms: number ): Promise< void > {
		this.commands.push( { kind: 'read', args: [ ms ] } );
		return Promise.resolve();
	}

	idle( ms: number ): Promise< void > {
		this.commands.push( { kind: 'idle', args: [ ms ] } );
		return Promise.resolve();
	}
}
