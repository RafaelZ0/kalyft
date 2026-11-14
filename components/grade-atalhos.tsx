import Link from "next/link";
import { IconeFuncao } from "@/components/icone-funcao";
import type { IconeFuncao as TipoIcone } from "@/lib/busca-funcoes";

export type Atalho = { href: string; titulo: string; icone: TipoIcone };

/** Grade de atalhos no estilo de app de banco: ícone no quadrado e o nome embaixo. */
export function GradeAtalhos({ atalhos, rotulo }: { atalhos: Atalho[]; rotulo: string }) {
  return (
    <nav aria-label={rotulo}>
      <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6 lg:grid-cols-8">
        {atalhos.map((a) => (
          <li key={a.href}>
            <Link href={a.href} className="atalho group">
              <span className="atalho-icone"><IconeFuncao icone={a.icone} /></span>
              <span className="atalho-rotulo">{a.titulo}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
