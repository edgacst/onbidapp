import bcrypt from "bcryptjs";
import { Router } from "express";
import {
  createSession,
  deleteMember,
  deleteSession,
  getMemberByEmail,
  getMemberById,
  getSession,
  insertMember,
  listMembers,
  normalizeEmail,
  pruneExpiredSessions,
  updateMemberFields,
} from "./db.js";

const router = Router();
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);
const PRIMARY_ADMIN_EMAIL = normalizeEmail(process.env.ADMIN_EMAIL || "freecompr20@gmail.com");

function readBearerToken(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function requireAuth(req, res, next) {
  pruneExpiredSessions();
  const token = readBearerToken(req);
  const session = getSession(token);
  if (!session?.member) {
    res.status(401).json({ ok: false, message: "로그인이 필요합니다." });
    return;
  }
  req.auth = session;
  next();
}

function requireAdmin(req, res, next) {
  if (req.auth?.member?.role !== "admin") {
    res.status(403).json({ ok: false, message: "관리자 권한이 필요합니다." });
    return;
  }
  next();
}

function publicMember(member) {
  return {
    id: member.id,
    email: member.email,
    name: member.name,
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt,
  };
}

function authPayload(member, token) {
  return {
    ok: true,
    token,
    member: publicMember(member),
  };
}

async function verifyPassword(password, hash) {
  return bcrypt.compare(String(password || ""), hash);
}

async function hashPassword(password) {
  return bcrypt.hash(String(password || ""), 12);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function resolveAdminRole(email, password) {
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");
  if (!adminPassword) return null;
  if (normalizeEmail(email) !== PRIMARY_ADMIN_EMAIL) return null;
  if (String(password || "") !== adminPassword) return null;
  return "admin";
}

export async function seedPrimaryAdmin() {
  const adminPassword = String(process.env.ADMIN_PASSWORD || "");
  if (!adminPassword) {
    console.warn("⚠️  ADMIN_PASSWORD 미설정 — 기본 관리자 계정 시드 생략");
    return;
  }
  const existing = getMemberByEmail(PRIMARY_ADMIN_EMAIL);
  const passwordHash = await hashPassword(adminPassword);
  if (!existing) {
    insertMember({
      email: PRIMARY_ADMIN_EMAIL,
      name: "관리자",
      passwordHash,
      role: "admin",
    });
    console.log(`✅ 관리자 계정 시드: ${PRIMARY_ADMIN_EMAIL}`);
    return;
  }
  if (existing.role !== "admin") {
    updateMemberFields(existing.id, { role: "admin" });
  }
}

router.post("/signup", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const name = String(req.body?.name || "").trim();
  const password = String(req.body?.password || "");

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, message: "유효한 이메일을 입력하세요." });
    return;
  }
  if (password.length < 6) {
    res.status(400).json({ ok: false, message: "비밀번호는 6자 이상이어야 합니다." });
    return;
  }
  if (getMemberByEmail(email)) {
    res.status(409).json({ ok: false, message: "이미 가입된 이메일입니다." });
    return;
  }

  const adminRole = resolveAdminRole(email, password);
  const role = adminRole || "member";
  const passwordHash = await hashPassword(password);
  const member = insertMember({ email, name, passwordHash, role });
  const token = createSession(member.id, SESSION_TTL_DAYS);
  res.status(201).json(authPayload(member, token));
});

router.post("/login", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!isValidEmail(email)) {
    res.status(400).json({ ok: false, message: "유효한 이메일을 입력하세요." });
    return;
  }

  const row = getMemberByEmail(email);
  if (!row) {
    res.status(401).json({ ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  const valid = await verifyPassword(password, row.password_hash);
  if (!valid) {
    res.status(401).json({ ok: false, message: "이메일 또는 비밀번호가 올바르지 않습니다." });
    return;
  }

  const member = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    status: row.status,
    joinedAt: row.joined_at,
  };

  if (member.status === "blocked") {
    res.status(403).json({ ok: false, message: "차단된 계정입니다. 관리자에게 문의하세요." });
    return;
  }

  const token = createSession(member.id, SESSION_TTL_DAYS);
  res.json(authPayload(member, token));
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ ok: true, member: publicMember(req.auth.member) });
});

router.post("/logout", (req, res) => {
  const token = readBearerToken(req);
  if (token) deleteSession(token);
  res.json({ ok: true });
});

router.get("/members", requireAuth, requireAdmin, (_req, res) => {
  res.json({ ok: true, members: listMembers() });
});

router.patch("/members/:id", requireAuth, requireAdmin, (req, res) => {
  const target = getMemberById(req.params.id);
  if (!target) {
    res.status(404).json({ ok: false, message: "회원을 찾을 수 없습니다." });
    return;
  }
  if (normalizeEmail(target.email) === PRIMARY_ADMIN_EMAIL && req.body?.role && req.body.role !== "admin") {
    res.status(400).json({ ok: false, message: "기본 관리자 역할은 변경할 수 없습니다." });
    return;
  }

  const next = {};
  if (req.body?.role === "admin" || req.body?.role === "member") next.role = req.body.role;
  if (req.body?.status === "active" || req.body?.status === "blocked") next.status = req.body.status;

  const updated = updateMemberFields(target.id, next);
  res.json({ ok: true, member: publicMember(updated) });
});

router.delete("/members/:id", requireAuth, requireAdmin, (req, res) => {
  const target = getMemberById(req.params.id);
  if (!target) {
    res.status(404).json({ ok: false, message: "회원을 찾을 수 없습니다." });
    return;
  }
  if (normalizeEmail(target.email) === PRIMARY_ADMIN_EMAIL) {
    res.status(400).json({ ok: false, message: "기본 관리자 계정은 삭제할 수 없습니다." });
    return;
  }
  if (req.auth.member.id === target.id) {
    res.status(400).json({ ok: false, message: "본인 계정은 삭제할 수 없습니다." });
    return;
  }
  deleteMember(target.id);
  res.json({ ok: true });
});

export default router;
