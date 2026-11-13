import { FormDados } from "@/components/contexto-dados";
import Link from "next/link";
import { exigirContextoDados as exigirUsuario } from "@/lib/auth/acompanhamento";
import { listarPesagens } from "@/lib/dal/corpo";
import { fotosDoUsuario, listarFotosCorpo } from "@/lib/dal/fotos-corpo";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { LIMITES_FOTO_CORPO, ROTULOS_POSICAO, type Posicao } from "@/lib/foto-corpo";
import { formatarGramas } from "@/lib/nutricao";
import { excluirFotoCorpoAcao } from "./actions";
import { EnviarFoto } from "./enviar-foto";

export const metadata = { title: "Fotos de progresso · Kalyft" };

export default async function PaginaFotos(props: PageProps<"/progresso/fotos">) {
  const { userId, modo, podeVerFotos, contextoId } = await exigirUsuario();
  if (!podeVerFotos) return <div className="space-y-4"><h1 className="page-heading">Fotos de progresso</h1><p>O aluno ainda não autorizou o acesso às fotos. Use “Solicitar fotos” na faixa de acompanhamento.</p><Link href="/progresso" className="inline-flex min-h-12 items-center underline">Voltar ao progresso</Link></div>;
  const hoje = hojeSaoPaulo();
  const sp = await props.searchParams;
  const pedidos = (Array.isArray(sp.f) ? sp.f : sp.f ? [sp.f] : []).filter((x): x is string => typeof x === "string");
  const [fotos, comparadas, pesagens] = await Promise.all([
    listarFotosCorpo(userId),
    fotosDoUsuario(userId, pedidos),
    listarPesagens(userId, somarDias(hoje, -730), 800),
  ]);
  const pesoDoDia = (data: string) => pesagens.find((p) => p.data === data)?.pesoKg ?? null;
  const rotulo = (f: { data: string; posicao: Posicao }) => {
    const peso = pesoDoDia(f.data);
    return `${formatarDataBr(f.data)} · ${ROTULOS_POSICAO[f.posicao]}${peso === null ? "" : ` · ${formatarGramas(peso)} kg`}`;
  };
  const marcadas = new Set(comparadas.map((f) => f.id));
  const linkComparar = (id: string) => {
    const ids = marcadas.has(id) ? comparadas.filter((f) => f.id !== id).map((f) => f.id) : [...comparadas.map((f) => f.id), id].slice(-2);
    return ids.length ? `/progresso/fotos?${ids.map((i) => `f=${i}`).join("&")}` : "/progresso/fotos";
  };

  return (
    <div className="page-stack">
      <Link href="/progresso" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Voltar</Link>
      <header className="space-y-2">
        <h1 className="page-heading">Fotos de progresso</h1>
        <p className="text-suave">
          {fotos.length} de {LIMITES_FOTO_CORPO.maximo} fotos. Acesso privado, compartilhado apenas com administradores autorizados. Elas não vão para a IA.
        </p>
      </header>

      {comparadas.length ? (
        <section aria-labelledby="comparar" className="app-card space-y-3">
          <h2 id="comparar" className="section-heading">Comparação</h2>
          <div className="grid grid-cols-2 gap-3">
            {comparadas.map((f) => (
              <figure key={f.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/fotos-corpo/${f.id}?contextoId=${encodeURIComponent(contextoId)}`} alt={`Foto de ${rotulo(f)}`} className="w-full rounded-xl border border-linha" />
                <figcaption className="text-sm text-suave">{rotulo(f)}</figcaption>
              </figure>
            ))}
          </div>
          <Link href="/progresso/fotos" className="inline-flex min-h-11 items-center font-semibold text-suave">Limpar comparação</Link>
        </section>
      ) : null}

      {modo === "proprio" ? <section aria-labelledby="nova" className="app-card space-y-4">
        <h2 id="nova" className="section-heading">Nova foto</h2>
        <EnviarFoto hoje={hoje} cheio={fotos.length >= LIMITES_FOTO_CORPO.maximo} />
      </section> : null}

      <section aria-labelledby="lista" className="app-card space-y-4">
        <h2 id="lista" className="section-heading">Suas fotos</h2>
        {fotos.length === 0 ? <p className="text-suave">Ainda não há fotos. Tire na mesma posição e com a mesma luz para comparar melhor.</p> : null}
        <ul className="grid grid-cols-2 gap-3">
          {fotos.map((f) => (
            <li key={f.id} className={`space-y-2 rounded-xl border-2 p-2 ${marcadas.has(f.id) ? "border-marca" : "border-linha"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fotos-corpo/${f.id}?contextoId=${encodeURIComponent(contextoId)}`} alt={`Foto de ${rotulo(f)}`} loading="lazy" className="aspect-[3/4] w-full rounded-lg object-cover" />
              <p className="text-sm font-semibold">{rotulo(f)}</p>
              {f.nota ? <p className="text-sm text-suave">{f.nota}</p> : null}
              <div className="flex gap-2">
                <Link href={linkComparar(f.id)} className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-borda text-sm font-semibold">
                  {marcadas.has(f.id) ? "Tirar" : "Comparar"}
                </Link>
                {modo === "proprio" ? <FormDados action={excluirFotoCorpoAcao}>
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className="min-h-11 rounded-lg border-2 border-erro px-3 text-sm font-semibold text-erro">Excluir</button>
                </FormDados> : null}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
