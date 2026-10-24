import { exigirUsuario } from "@/lib/auth/sessao";
import Link from "next/link";
import { IconeKalyft } from "@/lib/marca";
import { BarraAbas } from "./barra-abas";

export default async function LayoutApp({ children }: LayoutProps<"/">) {
  // Barreira de UX. Cada página e Server Action verifica a sessão de novo.
  await exigirUsuario();
  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <main className="px-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-[calc(6rem+env(safe-area-inset-bottom))]">
        <Link href="/hoje" aria-label="Kalyft, início" className="mb-4 inline-flex min-h-11 items-center">
          <IconeKalyft tamanho={40} id="app" />
        </Link>
        {children}
      </main>
      <BarraAbas />
    </div>
  );
}
