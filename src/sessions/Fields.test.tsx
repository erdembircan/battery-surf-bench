/**
 * Behavioral tests for the DataViews field builder.
 *
 * DataViews is `buildFields`' consumer: it reads each field's `id`, `label`,
 * sortability, `elements`, and the markup the `render` (and `getValue`)
 * callbacks produce per row. These tests treat that contract as the public
 * surface — they exercise the builder with descriptors and assert on the cells
 * a viewer would actually see, never on which private formatter ran.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import type { Field } from '@wordpress/dataviews';
import { buildFields } from '@/sessions/Fields';
import type {
	SessionFieldDescriptor,
	SessionFieldFormat,
	SessionRecord,
} from '@/sessions/Types';

/**
 * Builds a single-descriptor field set and returns the descriptor's field
 * (index 1; index 0 is always the injected title field).
 *
 * @param desc The field descriptor under test.
 * @return The DataViews field built for that descriptor.
 */
function fieldFor( desc: SessionFieldDescriptor ) {
	return buildFields( [ desc ] )[ 1 ];
}

/**
 * Renders a field's cell for a record, mounting its `render` the way DataViews
 * mounts a field component.
 *
 * @param field The DataViews field whose cell to render.
 * @param item  The session record to render against.
 * @return The Testing Library render result.
 */
function renderFieldCell( field: Field< SessionRecord >, item: SessionRecord ) {
	return render( createElement( field.render!, { item } ) );
}

/**
 * Renders a descriptor field's cell for a record built from the given meta.
 *
 * @param desc The field descriptor under test.
 * @param meta The record's meta payload.
 * @return The Testing Library render result.
 */
function renderCell(
	desc: SessionFieldDescriptor,
	meta: Record< string, unknown >
) {
	const item = { id: 1, meta } as SessionRecord;
	return renderFieldCell( fieldFor( desc ), item );
}

const EM_DASH = '—';

/**
 * Makes a minimal descriptor for the given format.
 *
 * @param format    The display format.
 * @param overrides Extra descriptor fields to merge in.
 * @return The descriptor.
 */
function descriptor(
	format: SessionFieldFormat,
	overrides: Partial< SessionFieldDescriptor > = {}
): SessionFieldDescriptor {
	return { key: 'value', label: 'Value', format, ...overrides };
}

describe( 'buildFields', () => {
	it( 'leads with a title field ahead of the descriptor fields', () => {
		const fields = buildFields( [
			descriptor( 'text', { key: 'a', label: 'A' } ),
			descriptor( 'datetime', { key: 'b', label: 'B' } ),
		] );

		expect( fields.map( ( f ) => f.id ) ).toEqual( [
			'title',
			'meta.a',
			'meta.b',
		] );
	} );

	it( 'maps each descriptor to a dot-path id into the record meta', () => {
		expect(
			fieldFor( descriptor( 'text', { key: 'bsb_status' } ) ).id
		).toBe( 'meta.bsb_status' );
	} );

	it( 'labels and enables sorting on built fields', () => {
		const field = fieldFor( descriptor( 'text', { label: 'Drain' } ) );
		expect( field.label ).toBe( 'Drain' );
		expect( field.enableSorting ).toBe( true );
	} );

	it( 'keeps descriptor elements so DataViews can offer them as filters', () => {
		const elements = [
			{ value: 'running', label: 'Running' },
			{ value: 'finished', label: 'Finished' },
		];
		const field = fieldFor( descriptor( 'status', { elements } ) );
		expect( field.elements ).toEqual( elements );
	} );

	it( 'limits enumerated filters to the "is any" operator for a clean IN query', () => {
		const elements = [ { value: 'finished', label: 'Finished' } ];
		expect(
			fieldFor( descriptor( 'status', { elements } ) ).filterBy
		).toEqual( { operators: [ 'isAny' ] } );

		// A plain (non-enumerated) column carries no filter operators.
		expect( fieldFor( descriptor( 'rate' ) ).filterBy ).toBe( undefined );
	} );
} );

describe( 'title field', () => {
	it( 'shows the rendered title when present', () => {
		const title = buildFields( [] )[ 0 ];
		const item = {
			id: 7,
			title: { rendered: 'Morning run' },
			meta: {},
		} as SessionRecord;

		expect( title.getValue!( { item } ) ).toBe( 'Morning run' );
		renderFieldCell( title, item );
		expect( screen.getByText( 'Morning run' ) ).toBeInTheDocument();
	} );

	it( 'falls back to a #id label when the session is untitled', () => {
		const title = buildFields( [] )[ 0 ];
		const item = { id: 42, meta: {} } as SessionRecord;

		expect( title.getValue!( { item } ) ).toBe( '#42' );
		renderFieldCell( title, item );
		expect( screen.getByText( '#42' ) ).toBeInTheDocument();
	} );
} );

describe( 'status format', () => {
	const status = descriptor( 'status', {
		key: 'bsb_status',
		elements: [ { value: 'finished', label: 'Finished' } ],
	} );

	it( 'renders the human label inside a status-coloured pill', () => {
		const { container } = renderCell( status, { bsb_status: 'finished' } );
		const badge = screen.getByText( 'Finished' );
		expect( badge ).toHaveClass( 'bsb-badge', 'bsb-badge--finished' );
		expect( container ).toContainElement( badge );
	} );

	it( 'carries a status dot the stylesheet can tint and pulse', () => {
		const { container } = renderCell( status, { bsb_status: 'finished' } );
		expect(
			container.querySelector( '.bsb-badge .bsb-badge__dot' )
		).not.toBeNull();
	} );

	it( 'falls back to the raw value when no element matches', () => {
		renderCell( status, { bsb_status: 'paused' } );
		expect( screen.getByText( 'paused' ) ).toHaveClass(
			'bsb-badge--paused'
		);
	} );

	it( 'shows an em dash when the status is unset', () => {
		const { container } = renderCell( status, {} );
		expect( container ).toHaveTextContent( EM_DASH );
		expect( container.querySelector( '.bsb-badge' ) ).toBeNull();
	} );
} );

describe( 'percent format', () => {
	const percent = descriptor( 'percent', { key: 'bsb_level' } );

	/**
	 * Reads the fill bar element from the last render.
	 *
	 * @return The fill element, or null when no bar rendered.
	 */
	function fill() {
		return document.querySelector( '.bsb-level__fill' );
	}

	it( 'renders a healthy level as a high-tone bar with its percentage', () => {
		renderCell( percent, { bsb_level: 0.8 } );
		expect( screen.getByText( '80%' ) ).toBeInTheDocument();
		expect( fill() ).toHaveClass( 'bsb-level__fill--high' );
		expect( fill() ).toHaveStyle( { width: '80%' } );
	} );

	it( 'tones a mid-range level differently from a critical one', () => {
		renderCell( percent, { bsb_level: 0.4 } );
		expect( fill() ).toHaveClass( 'bsb-level__fill--mid' );
		cleanup();
		renderCell( percent, { bsb_level: 0.1 } );
		expect( fill() ).toHaveClass( 'bsb-level__fill--low' );
	} );

	it( 'uses high tone at the 60% boundary and mid at 25%', () => {
		renderCell( percent, { bsb_level: 0.6 } );
		expect( fill() ).toHaveClass( 'bsb-level__fill--high' );
		cleanup();
		renderCell( percent, { bsb_level: 0.25 } );
		expect( fill() ).toHaveClass( 'bsb-level__fill--mid' );
	} );

	it( 'clamps out-of-range levels to 0–100%', () => {
		renderCell( percent, { bsb_level: 1.5 } );
		expect( screen.getByText( '100%' ) ).toBeInTheDocument();
		cleanup();
		renderCell( percent, { bsb_level: -0.2 } );
		expect( screen.getByText( '0%' ) ).toBeInTheDocument();
	} );

	it( 'shows an em dash when the level is not a number', () => {
		const { container } = renderCell( percent, { bsb_level: 'n/a' } );
		expect( container ).toHaveTextContent( EM_DASH );
		expect( fill() ).toBeNull();
	} );
} );

describe( 'datetime format', () => {
	const datetime = descriptor( 'datetime', { key: 'bsb_started_at' } );

	it( 'renders a parseable timestamp as a localized string', () => {
		const { container } = renderCell( datetime, {
			bsb_started_at: '2026-06-17 09:30:00',
		} );
		const expected = new Date(
			Date.parse( '2026-06-17T09:30:00' )
		).toLocaleString();
		expect( container ).toHaveTextContent( expected );
	} );

	it( 'echoes an unparseable value unchanged', () => {
		const { container } = renderCell( datetime, {
			bsb_started_at: 'not a date',
		} );
		expect( container ).toHaveTextContent( 'not a date' );
	} );

	it( 'shows an em dash when the timestamp is absent', () => {
		const { container } = renderCell( datetime, {} );
		expect( container ).toHaveTextContent( EM_DASH );
	} );
} );

describe( 'percentText format', () => {
	it( 'appends a percent sign, keeping a genuine zero', () => {
		expect(
			renderCell( descriptor( 'percentText' ), { value: 12 } ).container
		).toHaveTextContent( '12%' );
		expect(
			renderCell( descriptor( 'percentText' ), { value: 0 } ).container
		).toHaveTextContent( '0%' );
	} );

	it( 'shows an em dash when the value is absent', () => {
		expect(
			renderCell( descriptor( 'percentText' ), {} ).container
		).toHaveTextContent( EM_DASH );
	} );
} );

describe( 'percentOptional format', () => {
	it( 'appends a percent sign when the value applies', () => {
		expect(
			renderCell( descriptor( 'percentOptional' ), { value: 70 } )
				.container
		).toHaveTextContent( '70%' );
	} );

	it( 'shows an em dash when not applicable (zero or absent)', () => {
		expect(
			renderCell( descriptor( 'percentOptional' ), { value: 0 } )
				.container
		).toHaveTextContent( EM_DASH );
		expect(
			renderCell( descriptor( 'percentOptional' ), {} ).container
		).toHaveTextContent( EM_DASH );
	} );
} );

describe( 'rate format', () => {
	it( 'appends percent-per-hour when measured', () => {
		expect(
			renderCell( descriptor( 'rate' ), { value: 24.5 } ).container
		).toHaveTextContent( '24.5%/h' );
	} );

	it( 'shows an em dash when unmeasured (zero or absent)', () => {
		expect(
			renderCell( descriptor( 'rate' ), { value: 0 } ).container
		).toHaveTextContent( EM_DASH );
		expect(
			renderCell( descriptor( 'rate' ), {} ).container
		).toHaveTextContent( EM_DASH );
	} );

	it( 'wraps the numeric readout so the stylesheet can set it mono', () => {
		const { container } = renderCell( descriptor( 'rate' ), {
			value: 24.5,
		} );
		expect( container.querySelector( '.bsb-num' ) ).toHaveTextContent(
			'24.5%/h'
		);
	} );
} );

describe( 'runtime format', () => {
	it( 'shows seconds when under a minute', () => {
		const { container } = renderCell( descriptor( 'runtime' ), {
			value: 45,
		} );
		expect( container ).toHaveTextContent( '45s' );
	} );

	it( 'shows minutes when under an hour', () => {
		const { container } = renderCell( descriptor( 'runtime' ), {
			value: 1200,
		} );
		expect( container ).toHaveTextContent( '20m' );
	} );

	it( 'floors the minute, matching the cockpit H:MM readout', () => {
		// 2h 59.5m: the deck floors to 2:59, so the listing must too (not 3h).
		const { container } = renderCell( descriptor( 'runtime' ), {
			value: 10770,
		} );
		expect( container ).toHaveTextContent( '2h 59m' );
	} );

	it( 'shows hours and minutes when over an hour', () => {
		const { container } = renderCell( descriptor( 'runtime' ), {
			value: 29040,
		} );
		expect( container ).toHaveTextContent( '8h 4m' );
	} );

	it( 'drops the minutes on a whole hour', () => {
		const { container } = renderCell( descriptor( 'runtime' ), {
			value: 14400,
		} );
		expect( container ).toHaveTextContent( '4h' );
		expect( container ).not.toHaveTextContent( '4h 0m' );
	} );

	it( 'shows an em dash when not projected (zero or absent)', () => {
		expect(
			renderCell( descriptor( 'runtime' ), { value: 0 } ).container
		).toHaveTextContent( EM_DASH );
		expect(
			renderCell( descriptor( 'runtime' ), {} ).container
		).toHaveTextContent( EM_DASH );
	} );
} );

describe( 'enumerated text without an explicit format', () => {
	const enumerated = descriptor( 'text', {
		elements: [ { value: 'wifi', label: 'Wi-Fi' } ],
	} );

	it( 'renders the element label for a known value', () => {
		const { container } = renderCell( enumerated, { value: 'wifi' } );
		expect( container ).toHaveTextContent( 'Wi-Fi' );
	} );

	it( 'renders the raw value when no element matches', () => {
		const { container } = renderCell( enumerated, { value: 'lte' } );
		expect( container ).toHaveTextContent( 'lte' );
	} );

	it( 'shows an em dash when the value is absent', () => {
		const { container } = renderCell( enumerated, {} );
		expect( container ).toHaveTextContent( EM_DASH );
	} );
} );

describe( 'plain text format', () => {
	it( 'types the field as text without a renderer', () => {
		const field = fieldFor( descriptor( 'text' ) );
		expect( field.type ).toBe( 'text' );
		expect( field.render ).toBeUndefined();
	} );
} );
