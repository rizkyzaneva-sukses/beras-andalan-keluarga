import { getIronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";

export interface SessionData {
  userId?: string;
  username?: string;
  role?: "OWNER" | "KASIR";
}

if (!process.env.SESSION_SECRET) {
  console.warn("[SECURITY] SESSION_SECRET tidak di-set! Menggunakan default secret — JANGAN DEPLOY ke production tanpa mengatur SESSION_SECRET.");
}

export const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET || "change-me-to-a-random-string-at-least-32-chars-long",
  cookieName: "beras-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax" as const,
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  return session;
}

export async function clearSession() {
  const session = await getSession();
  session.destroy();
}
