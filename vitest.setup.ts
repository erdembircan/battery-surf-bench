/**
 * Vitest setup shared by every spec.
 *
 * Registers jest-dom's matchers on Vitest's `expect` (so specs can assert
 * `toBeInTheDocument`, `toHaveClass`, etc.) and unmounts any React trees and
 * clears mocks between tests to keep cases isolated.
 */

import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach( () => {
	cleanup();
	vi.clearAllMocks();
} );
