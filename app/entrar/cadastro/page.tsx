import { FormCadastro } from "../formularios";

export const metadata = { title: "Criar conta · Kalyft" };

export default function PaginaCadastro() {
  return (
    <>
      <h1 className="page-heading">Criar conta</h1>
      <p className="mt-3 mb-10 text-suave">
        Depois de confirmar o e-mail, sua conta precisa ser aprovada antes do primeiro uso.
      </p>
      <FormCadastro />
    </>
  );
}
