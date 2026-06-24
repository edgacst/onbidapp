import nodemailer from "nodemailer";

function mailConfig() {
  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || process.env.SMTP_USER || "",
    fromName: process.env.MAIL_FROM_NAME || "공매레이더",
  };
}

export function isMailConfigured() {
  const { user, pass } = mailConfig();
  return Boolean(user && pass);
}

function createTransport() {
  const { host, port, secure, user, pass } = mailConfig();
  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
}

export function buildWelcomeEmail({ email, name }) {
  const displayName = String(name || "").trim() || email.split("@")[0] || "회원";
  const subject = "[공매레이더] 회원가입을 환영합니다";
  const text = [
    `${displayName}님, 공매레이더에 가입해 주셔서 감사합니다.`,
    "",
    "이제 관심 물건 저장, 질문게시판 이용 등 회원 기능을 사용하실 수 있습니다.",
    "온비드 공매 물건 정보는 공고문·원문과 함께 꼭 확인해 주세요.",
    "",
    "감사합니다.",
    "공매레이더",
  ].join("\n");
  const html = `
    <div style="font-family:Malgun Gothic,Apple SD Gothic Neo,sans-serif;line-height:1.6;color:#17324a;max-width:560px">
      <h2 style="margin:0 0 12px;color:#151b23">회원가입을 환영합니다</h2>
      <p><strong>${displayName}</strong>님, 공매레이더에 가입해 주셔서 감사합니다.</p>
      <p>이제 관심 물건 저장, 질문게시판 이용 등 회원 기능을 사용하실 수 있습니다.</p>
      <p style="color:#5f7383;font-size:14px">온비드 공매 물건 정보는 공고문·원문과 함께 꼭 확인해 주세요.</p>
      <p style="margin-top:24px;color:#8a96a0;font-size:13px">공매레이더</p>
    </div>
  `;
  return { to: email, subject, text, html };
}

export async function sendWelcomeEmail({ email, name }) {
  const { from, fromName } = mailConfig();
  if (!isMailConfigured()) {
    throw new Error("SMTP not configured");
  }
  const payload = buildWelcomeEmail({ email, name });
  const transport = createTransport();
  await transport.sendMail({
    from: `"${fromName}" <${from}>`,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
}
