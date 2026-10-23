"use client";

import { useActionState, useRef } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { gerarImagemSemMetadados } from "@/app/(app)/treino/ia/imagem";
import { LIMITES_FOTO_CORPO, POSICOES, ROTULOS_POSICAO } from "@/lib/foto-corpo";
import { enviarFotoCorpo, type EstadoFoto } from "./actions";

const ALVO_BYTES = 400 * 1024;

// Reduz a foto no aparelho (1080 px, sem EXIF) e tenta qualidades menores até caber. O servidor confere tudo de novo.
async function prepararFoto(arquivo: File): Promise<File> {
  for (const qualidade of [0.8, 0.7, 0.6, 0.5]) {
    const f = await gerarImagemSemMetadados(arquivo, { ladoMaximo: 1080, qualidade });
    if (f.size <= ALVO_BYTES) return f;
  }
  throw new Error("Não consegui reduzir essa foto. Escolha outra.");
}

export function EnviarFoto({ hoje, cheio }: { hoje: string; cheio: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [estado, acao] = useActionState<EstadoFoto, FormData>(async (anterior, form) => {
    const arquivo = form.get("foto");
    if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha uma foto." };
    try {
      form.set("foto", await prepararFoto(arquivo));
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Não consegui preparar a foto." };
    }
    const r = await enviarFotoCorpo(anterior, form);
    if (r.ok) formRef.current?.reset();
    return r;
  }, {});

  if (cheio) return <Aviso>Você chegou ao limite de {LIMITES_FOTO_CORPO.maximo} fotos. Exclua alguma antiga para enviar outra.</Aviso>;

  return (
    <form ref={formRef} action={acao} className="space-y-6" noValidate>
      <label className="block space-y-2">
        <span className="block font-semibold">Foto</span>
        <input name="foto" type="file" accept="image/jpeg,image/png,image/webp" className="block min-h-12 w-full text-base" required />
      </label>
      <fieldset className="space-y-2">
        <legend className="font-semibold">Posição</legend>
        <div className="grid grid-cols-3 gap-2">
          {POSICOES.map((p, i) => (
            <label key={p} className="flex min-h-12 cursor-pointer items-center justify-center rounded-xl border-2 border-linha px-2 has-[:checked]:border-marca has-[:checked]:font-bold">
              <input type="radio" name="posicao" value={p} defaultChecked={i === 0} className="sr-only" />
              {ROTULOS_POSICAO[p]}
            </label>
          ))}
        </div>
      </fieldset>
      <Campo nome="data" rotulo="Dia da foto" tipo="date" valor={hoje} />
      <Campo nome="nota" rotulo="Nota (opcional)" maxLength={LIMITES_FOTO_CORPO.notaMax} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">Foto salva.</Aviso> : null}
      <BotaoEnviar>Salvar foto</BotaoEnviar>
      <p className="text-sm text-suave">A foto é reduzida no seu aparelho, guardada só na sua conta e nunca é enviada à IA.</p>
    </form>
  );
}
