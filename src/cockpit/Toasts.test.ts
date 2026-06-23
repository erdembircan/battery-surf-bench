/**
 * Tests for the toast model — the queue and the context-driven lifecycle behind
 * the cockpit's notification pill. Pure over a plain context and instance, with
 * no Interactivity runtime or DOM.
 */

import { describe, it, expect } from 'vitest';
import { ToastQueue, enqueueToast, finishToast, TOAST_HOLD_MS } from './Toasts';
import { type CockpitContext } from './CockpitContext';
import { type InstanceState } from './RunInstance';

/** A context double carrying only the toast fields the queue touches. */
const context = (): CockpitContext =>
	( {
		toastKind: '',
		toastText: '',
		toastPhase: '',
		toastStrings: { error: 'Error message', notice: 'Notice message' },
	} ) as unknown as CockpitContext;

/** An instance double holding a fresh toast queue. */
const instance = (): InstanceState =>
	( { toasts: new ToastQueue() } ) as unknown as InstanceState;

describe( 'ToastQueue', () => {
	it( 'is first-in, first-out and tracks its size', () => {
		const queue = new ToastQueue();
		expect( queue.size ).toBe( 0 );

		queue.enqueue( 'error' );
		queue.enqueue( 'notice' );
		expect( queue.size ).toBe( 2 );

		expect( queue.next() ).toBe( 'error' );
		expect( queue.next() ).toBe( 'notice' );
		expect( queue.next() ).toBeNull();
		expect( queue.size ).toBe( 0 );
	} );

	it( 'clears every pending toast', () => {
		const queue = new ToastQueue();
		queue.enqueue( 'error' );
		queue.enqueue( 'error' );
		queue.clear();
		expect( queue.size ).toBe( 0 );
		expect( queue.next() ).toBeNull();
	} );

	it( 'holds for ten seconds', () => {
		expect( TOAST_HOLD_MS ).toBe( 10000 );
	} );
} );

describe( 'enqueueToast', () => {
	it( 'shows the toast immediately when the pill is free', () => {
		const ctx = context();
		const inst = instance();

		enqueueToast( ctx, inst, 'error' );

		expect( ctx.toastKind ).toBe( 'error' );
		expect( ctx.toastText ).toBe( 'Error message' );
		expect( ctx.toastPhase ).toBe( 'entering' );
		expect( inst.toasts.size ).toBe( 0 );
	} );

	it( 'queues a second toast behind the one on screen', () => {
		const ctx = context();
		const inst = instance();

		enqueueToast( ctx, inst, 'error' );
		enqueueToast( ctx, inst, 'notice' );

		// The first still shows; the second waits.
		expect( ctx.toastKind ).toBe( 'error' );
		expect( inst.toasts.size ).toBe( 1 );
	} );
} );

describe( 'finishToast', () => {
	it( 'clears the toast and shows the next queued one', () => {
		const ctx = context();
		const inst = instance();

		enqueueToast( ctx, inst, 'error' );
		enqueueToast( ctx, inst, 'notice' );

		finishToast( ctx, inst );

		// The queued notice is pumped in, entering fresh.
		expect( ctx.toastKind ).toBe( 'notice' );
		expect( ctx.toastText ).toBe( 'Notice message' );
		expect( ctx.toastPhase ).toBe( 'entering' );
		expect( inst.toasts.size ).toBe( 0 );
	} );

	it( 'leaves the pill idle when nothing is queued', () => {
		const ctx = context();
		const inst = instance();

		enqueueToast( ctx, inst, 'error' );
		finishToast( ctx, inst );

		expect( ctx.toastKind ).toBe( '' );
		expect( ctx.toastText ).toBe( '' );
		expect( ctx.toastPhase ).toBe( '' );
	} );
} );
