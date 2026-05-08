import { ensureSchema, clearAllTables } from '../repository';

export async function setupTestDatabase() {
	await ensureSchema();
}

export async function resetTestDatabase() {
	await clearAllTables();
}

export async function teardownTestDatabase() {
	// SQLite in-memory databases are cleaned up automatically
	// No explicit teardown needed
}
