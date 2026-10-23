import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarPesagens } from "@/lib/dal/corpo";
import { fotosDoUsuario, listarFotosCorpo } from "@/lib/dal/fotos-corpo";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { LIMITES_FOTO_CORPO, ROTULOS_POSICAO, type Posicao } from "@/lib/foto-corpo";
import { formatarGramas } from "@/lib/nutricao";
import { excluirFotoCorpoAcao } from "./actions";
import { EnviarFoto } from "./enviar-foto";

export const metadata = { title: "Fotos de progresso · Kalyft" };

export default async function PaginaFotos(props: PageProps<"/progresso/fotos">) {
  const { userId } = await exigirUsuario();
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
    <div className="space-y-10">
      <Link href="/progresso" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Voltar</Link>
      <header className="space-y-2">
        <h1 className="text-3xl font-black">Fotos de progresso</h1>
        <p className="text-suave">
          {fotos.length} de {LIMITES_FOTO_CORPO.maximo} fotos. Só você vê. Elas ficam na sua conta e não vão para a IA.
        </p>
      </header>

      {comparadas.length ? (
        <section aria-labelledby="comparar" className="space-y-3">
          <h2 id="comparar" className="text-2xl font-bold">Comparação</h2>
          <div className="grid grid-cols-2 gap-3">
            {comparadas.map((f) => (
              <figure key={f.id} className="space-y-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/fotos-corpo/${f.id}`} alt={`Foto de ${rotulo(f)}`} className="w-full rounded-xl border-2 border-linha" />
                <figcaption className="text-sm text-suave">{rotulo(f)}</figcaption>
              </figure>
            ))}
          </div>
          <Link href="/progresso/fotos" className="inline-flex min-h-11 items-center font-semibold text-suave">Limpar comparação</Link>
        </section>
      ) : null}

      <section aria-labelledby="nova" className="space-y-4">
        <h2 id="nova" className="text-2xl font-bold">Nova foto</h2>
        <EnviarFoto hoje={hoje} cheio={fotos.length >= LIMITES_FOTO_CORPO.maximo} />
      </section>

      <section aria-labelledby="lista" className="space-y-4">
        <h2 id="lista" className="text-2xl font-bold">Suas fotos</h2>
        {fotos.length === 0 ? <p className="text-suave">Ainda não há fotos. Tire na mesma posição e com a mesma luz para comparar melhor.</p> : null}
        <ul className="grid grid-cols-2 gap-3">
          {fotos.map((f) => (
            <li key={f.id} className={`space-y-2 rounded-xl border-2 p-2 ${marcadas.has(f.id) ? "border-marca" : "border-linha"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/fotos-corpo/${f.id}`} alt={`Foto de ${rotulo(f)}`} loading="lazy" className="aspect-[3/4] w-full rounded-lg object-cover" />
              <p className="text-sm font-semibold">{rotulo(f)}</p>
              {f.nota ? <p className="text-sm text-suave">{f.nota}</p> : null}
              <div className="flex gap-2">
                <Link href={linkComparar(f.id)} className="flex min-h-11 flex-1 items-center justify-center rounded-lg border-2 border-borda text-sm font-semibold">
                  {marcadas.has(f.id) ? "Tirar" : "Comparar"}
                </Link>
                <form action={excluirFotoCorpoAcao}>
                  <input type="hidden" name="id" value={f.id} />
                  <button type="submit" className="min-h-11 rounded-lg border-2 border-erro px-3 text-sm font-semibold text-erro">Excluir</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
