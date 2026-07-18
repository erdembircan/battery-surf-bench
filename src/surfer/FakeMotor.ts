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
 * Test double for {@link Motor}: never touches the DOM, just records every
 * command it was asked to perform so a test can assert on the sequence and
 * arguments without a real browser.
 */
export class FakeMotor implements Motor {
	readonly commands: RecordedCommand[] = [];

	scrollBy( px: number, ms: number ): Promise< void > {
		this.commands.push( { kind: 'scrollBy', args: [ px, ms ] } );
		return Promise.resolve();
	}

	pointerDrift( ms: number ): Promise< void > {
		this.commands.push( { kind: 'pointerDrift', args: [ ms ] } );
		return Promise.resolve();
	}

	selectSnippet(): Promise< void > {
		this.commands.push( { kind: 'selectSnippet', args: [] } );
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
