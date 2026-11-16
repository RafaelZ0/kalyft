import { DIMENSOES_POSE, type Pose } from "@/lib/jornada-textos";

/**
 * Kalu numa pose estática (WebP otimizado, 320/640 px). A fala vai em texto real ao lado, para leitor de tela;
 * a imagem é decorativa. Entrada suave só para quem não pediu menos movimento.
 */
export function Kalu({ pose, fala, tamanho = "medio" }: { pose: Pose; fala?: string; tamanho?: "pequeno" | "medio" }) {
  const [w, h] = DIMENSOES_POSE[pose];
  const largura = tamanho === "pequeno" ? "w-16" : "w-28 sm:w-36";
  return (
    <div className="flex items-end gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- WebP estático já otimizado (320/640), sem servidor de imagens */}
      <img
        src={`/kalu/${pose}-320.webp`}
        srcSet={`/kalu/${pose}-320.webp 320w, /kalu/${pose}-640.webp 640w`}
        sizes={tamanho === "pequeno" ? "64px" : "(min-width: 640px) 144px, 112px"}
        width={w}
        height={h}
        alt=""
        decoding="async"
        className={`${largura} h-auto shrink-0 select-none motion-safe:animate-[kalu-entrar_400ms_ease-out]`}
      />
      {fala ? (
        <p className="relative mb-3 rounded-2xl rounded-bl-sm border border-linha bg-superficie px-4 py-3 text-sm font-medium leading-snug">
          <span className="sr-only">Kalu: </span>
          {fala}
        </p>
      ) : null}
    </div>
  );
}
