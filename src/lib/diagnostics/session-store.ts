import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { DiagnosticSession } from "./types";

type SessionRow = {
  snapshot: string;
};

// Vercel's deployment bundle is read-only. Its ephemeral /tmp directory is
// writable for the lifetime of a serverless instance, while local development
// keeps using the durable project data directory.
const defaultDatabasePath = process.env.VERCEL
  ? join("/tmp", "workshop-master.sqlite")
  : join(process.cwd(), "data", "workshop-master.sqlite");

const databasePath = process.env.WORKSHOP_MASTER_DB_PATH ?? defaultDatabasePath;

let database: DatabaseSync | undefined;

function getDatabase() {
  if (database) {
    return database;
  }

  mkdirSync(dirname(databasePath), { recursive: true });
  database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS diagnostic_sessions (
      id TEXT PRIMARY KEY,
      snapshot TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);
  database.exec(`
    CREATE TABLE IF NOT EXISTS channel_session_map (
      channel TEXT NOT NULL,
      external_user_id TEXT NOT NULL,
      session_id TEXT NOT NULL,
      PRIMARY KEY (channel, external_user_id)
    )
  `);

  return database;
}

export function createSession(): DiagnosticSession {
  const now = new Date().toISOString();
  const session: DiagnosticSession = {
    id: crypto.randomUUID(),
    machine: {},
    symptoms: [],
    observations: [],
    hypotheses: [],
    tests: [],
    retrievedSources: [],
    safetyWarnings: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };

  saveSession(session);
  return session;
}

export function getSession(id: string): DiagnosticSession | undefined {
  const row = getDatabase()
    .prepare("SELECT snapshot FROM diagnostic_sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;

  if (!row) {
    return undefined;
  }

  const session = JSON.parse(row.snapshot) as DiagnosticSession;
  return { ...session, retrievedSources: session.retrievedSources ?? [] };
}

export function saveSession(session: DiagnosticSession): void {
  session.updatedAt = new Date().toISOString();
  getDatabase()
    .prepare(`
      INSERT INTO diagnostic_sessions (id, snapshot, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at
    `)
    .run(session.id, JSON.stringify(session), session.createdAt, session.updatedAt);
}

export function getOrCreateChannelSession(
  channel: string,
  externalUserId: string,
): DiagnosticSession {
  const mapped = getDatabase()
    .prepare(
      "SELECT session_id FROM channel_session_map WHERE channel = ? AND external_user_id = ?",
    )
    .get(channel, externalUserId) as { session_id: string } | undefined;

  if (mapped) {
    const existing = getSession(mapped.session_id);
    if (existing) {
      return existing;
    }
  }

  const session = createSession();
  getDatabase()
    .prepare(`
      INSERT INTO channel_session_map (channel, external_user_id, session_id)
      VALUES (?, ?, ?)
      ON CONFLICT(channel, external_user_id) DO UPDATE SET session_id = excluded.session_id
    `)
    .run(channel, externalUserId, session.id);

  return session;
}
