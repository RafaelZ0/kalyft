import { redirect } from "next/navigation";
import { exigirLogin } from "@/lib/auth/sessao";
import { encerrarContextoAcompanhamento } from "@/lib/auth/acompanhamento";

export const metadata = { title: "Atualize o acompanhamento · Kalyft" };

async function voltarParaConta() {
  "use server";
  await encerrarContextoAcompanhamento();
  redirect("/hoje");
}

export default async function AcompanhamentoExpirado() {
  await exigirLogin();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <h1 className="text-4xl font-black leading-tight">Atualize o acompanhamento.</h1>
      <p className="mt-4 text-lg text-suave">A conta acompanhada mudou ou o acesso terminou. Nenhuma alteração foi salva. Volte para sua conta antes de continuar.</p>
      <form action={voltarParaConta} className="mt-10">
        <button type="submit" className="min-h-12 rounded-full border-2 border-borda px-5 font-semibold">Voltar para minha conta</button>
      </form>
    </main>
  );
}
