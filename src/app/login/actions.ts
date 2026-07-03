"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { createSession, destroySession } from "@/lib/auth";

export async function login(
  email: string,
  password: string
): Promise<{ error?: string }> {
  const expectedEmail = process.env.PRACTITIONER_EMAIL ?? "";
  const hash = process.env.PRACTITIONER_PASSWORD_HASH ?? "";
  const emailOk = email.trim().toLowerCase() === expectedEmail.toLowerCase();
  const passOk = hash ? await bcrypt.compare(password, hash) : false;
  if (!emailOk || !passOk) {
    return { error: "אימייל או סיסמה שגויים" };
  }
  await createSession(expectedEmail);
  return {};
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
