import { SQLocalDrizzle } from 'sqlocal/drizzle';
import { drizzle } from 'drizzle-orm/sqlite-proxy';
import * as schema from './schema.js';

const client = new SQLocalDrizzle('db.db');

export const sql = client.sql;
export const db = drizzle(client.driver, client.batchDriver, { schema });
