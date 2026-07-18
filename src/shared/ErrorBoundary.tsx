/**
 * Catches a render-time crash in an admin screen's React tree and renders a
 * `<Notice>` plus a reload affordance instead of leaving a blank screen.
 *
 * Both admin roots (`src/settings/index.tsx`, `src/sessions/index.tsx`) mount
 * their app inside this boundary. React error boundaries must be class
 * components — there is no Hooks equivalent of `getDerivedStateFromError`/
 * `componentDidCatch` — so this is the one class component in the admin
 * screens' React trees.
 */

import { Component } from '@wordpress/element';
import type { ErrorInfo, ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { Notice } from '@/shared/Notice';

interface ErrorBoundaryProps {
	children: ReactNode;
}

interface ErrorBoundaryState {
	error: Error | null;
}

// `@wordpress/element`'s `Component` is a straight re-export of the exact same
// `react` runtime class this project's own top-level `react` dependency
// provides (both resolve to the one physical `react` package pnpm installs) —
// but `@wordpress/element` bundles its own `@types/react`, a different
// version than this project's own devDependency, and the two versions'
// `ReactNode` shapes differ enough (e.g. `bigint` support) that extending the
// value typed through wp-element's own declarations fails to type-check
// `render()`'s return. Retyping the identical runtime value through this
// project's own `react` types instead keeps every method on this class
// checked against one consistent type universe.
const BaseComponent = Component as unknown as typeof import('react').Component;

/**
 * Reloads the current admin screen — the fallback's only recovery action,
 * since a crashed React tree cannot repair its own state from inside itself.
 */
function reload(): void {
	window.location.reload();
}

/** Wraps an admin screen's mounted app, rendering a fallback if it throws. */
export class ErrorBoundary extends BaseComponent<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	state: ErrorBoundaryState = { error: null };

	/**
	 * Derives the boundary's state from a thrown render error, switching it
	 * into its fallback render on the very next render pass.
	 *
	 * @param error The error thrown by a descendant during render.
	 * @return The state update.
	 */
	static getDerivedStateFromError( error: Error ): ErrorBoundaryState {
		return { error };
	}

	/**
	 * Logs the crash for developers once React has committed the fallback.
	 *
	 * @param error     The error thrown by a descendant during render.
	 * @param errorInfo The component stack the error was thrown from.
	 */
	componentDidCatch( error: Error, errorInfo: ErrorInfo ): void {
		// eslint-disable-next-line no-console
		console.error(
			'Battery Surf Bench admin screen crashed',
			error,
			errorInfo
		);
	}

	render(): ReactNode {
		const { error } = this.state;

		if ( error ) {
			return (
				<div className="bsb-error-boundary">
					<Notice
						kind="error"
						message={ __(
							'Something went wrong loading this screen.',
							'battery-surf-bench'
						) }
					/>
					<button
						type="button"
						className="bsb-admin-pill bsb-admin-pill--outline"
						onClick={ reload }
					>
						{ __( 'Reload', 'battery-surf-bench' ) }
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}
