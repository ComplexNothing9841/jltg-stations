import '@testing-library/jest-dom/vitest';
import { beforeEach, afterEach, vi } from 'vitest';

// Mock crypto.randomUUID
let counter = 0;
const originalRandomUUID = global.crypto.randomUUID;

beforeEach(() => {
	counter = 0;
	global.crypto.randomUUID = vi.fn(() => `test-uuid-${counter++}`);
});

// Clean up after each test
afterEach(() => {
	vi.clearAllMocks();
	global.crypto.randomUUID = originalRandomUUID;
});
