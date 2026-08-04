"use server";

import { getSession, clearSession } from "./session";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

export async function login(username: string, password: string) {
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return { error: "Username atau password salah" };

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) return { error: "Username atau password salah" };

  const session = await getSession();
  session.userId = user.id;
  session.username = user.username;
  session.role = user.role;
  await session.save();

  const redirectTo = user.role === "KASIR" ? "/penjualan" : "/dashboard";
  return { success: true, redirectTo };
}

export async function logout() {
  await clearSession();
  redirect("/login");
}

export async function getCurrentUser() {
  const session = await getSession();
  if (!session.userId) return null;
  return {
    id: session.userId,
    username: session.username!,
    role: session.role!,
  };
}
