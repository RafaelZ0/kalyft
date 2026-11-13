import { redirect } from "next/navigation";
import { obterSessao } from "@/lib/auth/sessao";
import { FormEntrar } from "./formularios";

export const metadata = { title: "Entrar · Kalyft" };

export default async function PaginaEntrar() {
  if (await obterSessao()) redirect("/hoje");
  return (
    <>
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Bem-vindo de volta.</h1>
      <p className="mb-7 text-sm text-suave">Entre para acompanhar seu dia.</p>
      <FormEntrar />
    </>
  );
}
