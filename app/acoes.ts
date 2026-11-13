"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/server";
import { registrarErro } from "@/lib/log";
import { cookies } from "next/headers";

export async function sair(): Promise<void> {
  (await cookies()).delete("kalyft_acompanhamento");
  try {
    await auth.signOut();
  } catch (e) {
    registrarErro("sair", e);
  }
  redirect("/entrar");
}
