import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import initSqlJs from "sql.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDbPath = path.join(root, "data", "members.sqlite");
const dbPath = process.env.DATABASE_PATH || defaultDbPath;

let db;

function persistDatabase() {
  const data = db.export();
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function run(sql, params = []) {
  db.run(sql, params);
  persistDatabase();
}

function getOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function getAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function createMemberId() {
  return `member-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function rowToMember(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
  };
}

export async function initDatabase() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const SQL = await initSqlJs();
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS members (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      status TEXT NOT NULL DEFAULT 'active',
      joined_at TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      member_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE CASCADE
    )
  `);
  db.run("CREATE INDEX IF NOT EXISTS idx_sessions_member_id ON sessions(member_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)");
  persistDatabase();
}

export function getMemberByEmail(email) {
  return getOne("SELECT * FROM members WHERE lower(email) = lower(?)", [normalizeEmail(email)]);
}

export function getMemberById(id) {
  return getOne("SELECT * FROM members WHERE id = ?", [String(id || "")]);
}

export function listMembers() {
  return getAll("SELECT * FROM members ORDER BY joined_at DESC").map(rowToMember);
}

export function insertMember({ email, name, passwordHash, role = "member" }) {
  const record = {
    id: createMemberId(),
    email: normalizeEmail(email),
    name: String(name || "").trim() || normalizeEmail(email).split("@")[0] || "회원",
    password_hash: passwordHash,
    role,
    status: "active",
    joined_at: new Date().toISOString(),
  };
  run(`
    INSERT INTO members (id, email, name, password_hash, role, status, joined_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [record.id, record.email, record.name, record.password_hash, record.role, record.status, record.joined_at]);
  return rowToMember(record);
}

export function updateMemberFields(id, fields) {
  const current = getMemberById(id);
  if (!current) return null;
  const next = {
    role: fields.role || current.role,
    status: fields.status || current.status,
    name: fields.name ? String(fields.name).trim() : current.name,
  };
  run("UPDATE members SET role = ?, status = ?, name = ? WHERE id = ?", [
    next.role,
    next.status,
    next.name,
    id,
  ]);
  return rowToMember(getMemberById(id));
}

export function deleteMember(id) {
  run("DELETE FROM members WHERE id = ?", [id]);
}

export function createSession(memberId, ttlDays = 30) {
  const token = crypto.randomBytes(32).toString("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlDays * 24 * 60 * 60 * 1000);
  run(`
    INSERT INTO sessions (token, member_id, created_at, expires_at)
    VALUES (?, ?, ?, ?)
  `, [token, memberId, now.toISOString(), expiresAt.toISOString()]);
  return token;
}

export function getSession(token) {
  if (!token) return null;
  const row = getOne(`
    SELECT s.token, s.member_id, s.expires_at, m.id, m.email, m.name, m.password_hash, m.role, m.status, m.joined_at
    FROM sessions s
    JOIN members m ON m.id = s.member_id
    WHERE s.token = ?
  `, [token]);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    run("DELETE FROM sessions WHERE token = ?", [token]);
    return null;
  }
  return {
    token: row.token,
    member: rowToMember(row),
    passwordHash: row.password_hash,
  };
}

export function deleteSession(token) {
  run("DELETE FROM sessions WHERE token = ?", [token]);
}

export function pruneExpiredSessions() {
  run("DELETE FROM sessions WHERE expires_at < ?", [new Date().toISOString()]);
}

export function getDatabasePath() {
  return dbPath;
}

export { normalizeEmail, rowToMember };
