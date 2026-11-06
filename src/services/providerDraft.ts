import * as SQLite from 'expo-sqlite';

const DATABASE_NAME = 'servixp-registration.db';
const DRAFT_KEY = 'provider-registration';

export type ProviderRegistrationDraft = Record<string, unknown>;

async function getDatabase() {
  const database = await SQLite.openDatabaseAsync(DATABASE_NAME);
  await database.execAsync('CREATE TABLE IF NOT EXISTS registration_drafts (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
  return database;
}

export async function saveProviderDraft(draft: ProviderRegistrationDraft) {
  const database = await getDatabase();
  await database.runAsync(
    'INSERT INTO registration_drafts (id, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at',
    DRAFT_KEY,
    JSON.stringify(draft),
    new Date().toISOString(),
  );
}

export async function loadProviderDraft(): Promise<ProviderRegistrationDraft | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<{ payload: string }>('SELECT payload FROM registration_drafts WHERE id = ?', DRAFT_KEY);
  if (!row) return null;
  try { return JSON.parse(row.payload) as ProviderRegistrationDraft; } catch { return null; }
}

export async function clearProviderDraft() {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM registration_drafts WHERE id = ?', DRAFT_KEY);
}
