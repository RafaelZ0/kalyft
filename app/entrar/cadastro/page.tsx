import { AVISO_PRIVACIDADE } from "@/lib/aviso-privacidade";
import { FormCadastro } from "../formularios";

export const metadata = { title: "Criar conta · Kalyft" };

export default function PaginaCadastro() {
  return (
    <>
      <h1 className="page-heading">Criar conta</h1>
      <p className="mt-3 text-suave">Depois de confirmar o e-mail, é só entrar.</p>
      <p data-teste="aviso-privacidade" className="mt-3 mb-10 text-sm text-suave">{AVISO_PRIVACIDADE}</p>
      <FormCadastro />
    </>
  );
}
