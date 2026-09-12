import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

import type { DiagnosticSession } from "./types";

type SessionRow = { snapshot: string };
type SupabaseSessionRow = { snapshot: DiagnosticSession };
type SupabaseChannelRow = { session_id: string };

// SQLite is retained for local development. Production deployments use the
// Supabase REST API when both server-only environment variables are present.
const defaultDatabasePath = process.env.VERCEL
  ? join("/tmp", "workshop-master.sqlite")
  : join(process.cwd(), "data", "workshop-master.sqlite");
const databasePath = process.env.WORKSHOP_MASTER_DB_PATH ?? defaultDatabasePath;

let database: DatabaseSync | undefined;

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url && !serviceRoleKey) return undefined;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together.");
  }
  return { url, serviceRoleKey };
}

async function supabaseRequest(path: string, init: RequestInit): Promise<Response> {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase is not configured.");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) {
    throw new Error(`Supabase session storage failed (${response.status}).`);
  }
  return response;
}

function getDatabase() {
  if (database) return database;

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

function hydrateSession(snapshot: string | DiagnosticSession): DiagnosticSession {
  const session = typeof snapshot === "string" ? (JSON.parse(snapshot) as DiagnosticSession) : snapshot;
  return {
    ...session,
    retrievedSources: (session.retrievedSources ?? []).map((source) => ({
      ...source,
      sourceType: source.sourceType ?? "web",
      query: source.query ?? "",
    })),
    retrievalQueries: session.retrievalQueries ?? [],
  };
}

export async function createSession(): Promise<DiagnosticSession> {
  const now = new Date().toISOString();
  const session: DiagnosticSession = {
    id: crypto.randomUUID(),
    machine: {},
    symptoms: [],
    observations: [],
    hypotheses: [],
    tests: [],
    retrievedSources: [],
    retrievalQueries: [],
    safetyWarnings: [],
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  await saveSession(session);
  return session;
}

export async function getSession(id: string): Promise<DiagnosticSession | undefined> {
  const supabase = getSupabaseConfig();
  if (supabase) {
    const response = await supabaseRequest(
      `diagnostic_sessions?id=eq.${encodeURIComponent(id)}&select=snapshot`,
      { method: "GET" },
    );
    const [row] = (await response.json()) as SupabaseSessionRow[];
    return row ? hydrateSession(row.snapshot) : undefined;
  }

  const row = getDatabase()
    .prepare("SELECT snapshot FROM diagnostic_sessions WHERE id = ?")
    .get(id) as SessionRow | undefined;
  return row ? hydrateSession(row.snapshot) : undefined;
}

export async function saveSession(session: DiagnosticSession): Promise<void> {
  session.updatedAt = new Date().toISOString();
  const supabase = getSupabaseConfig();
  if (supabase) {
    await supabaseRequest("diagnostic_sessions?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        id: session.id,
        snapshot: session,
        created_at: session.createdAt,
        updated_at: session.updatedAt,
      }),
    });
    return;
  }

  getDatabase()
    .prepare(`
      INSERT INTO diagnostic_sessions (id, snapshot, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot, updated_at = excluded.updated_at
    `)
    .run(session.id, JSON.stringify(session), session.createdAt, session.updatedAt);
}

export async function getOrCreateChannelSession(
  channel: string,
  externalUserId: string,
): Promise<DiagnosticSession> {
  const supabase = getSupabaseConfig();
  if (supabase) {
    const response = await supabaseRequest(
      `channel_session_map?channel=eq.${encodeURIComponent(channel)}&external_user_id=eq.${encodeURIComponent(externalUserId)}&select=session_id`,
      { method: "GET" },
    );
    const [mapped] = (await response.json()) as SupabaseChannelRow[];
    if (mapped) {
      const existing = await getSession(mapped.session_id);
      if (existing) return existing;
    }

    const session = await createSession();
    await supabaseRequest("channel_session_map?on_conflict=channel,external_user_id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        channel,
        external_user_id: externalUserId,
        session_id: session.id,
      }),
    });
    return session;
  }

  const mapped = getDatabase()
    .prepare(
      "SELECT session_id FROM channel_session_map WHERE channel = ? AND external_user_id = ?",
    )
    .get(channel, externalUserId) as { session_id: string } | undefined;
  if (mapped) {
    const existing = await getSession(mapped.session_id);
    if (existing) return existing;
  }

  const session = await createSession();
  getDatabase()
    .prepare(`
      INSERT INTO channel_session_map (channel, external_user_id, session_id)
      VALUES (?, ?, ?)
      ON CONFLICT(channel, external_user_id) DO UPDATE SET session_id = excluded.session_id
    `)
    .run(channel, externalUserId, session.id);
  return session;
}
