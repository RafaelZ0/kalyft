import { Logotipo } from "@/lib/marca";
import { SeletorAparencia } from "@/components/aparencia";
import { Check, HeartHandshake, Utensils, Dumbbell } from "lucide-react";

export default function LayoutEntrar({ children }: LayoutProps<"/entrar">) {
  return (
    <main className="auth-layout">
      <section className="auth-story pr-10" aria-label="Sobre o Kalyft">
        <span className="icon-badge mb-7"><HeartHandshake size={24} aria-hidden="true" /></span>
        <h2 className="max-w-lg text-5xl font-semibold leading-[1.12] tracking-tight">Seu ritmo.<br />Sua evolução.</h2>
        <p className="mt-6 max-w-md text-lg leading-relaxed text-suave">Alimentação e treino juntos para acompanhar seu emagrecimento, um dia de cada vez.</p>
        <div className="mt-10 grid max-w-sm gap-4">
          <div className="flex items-center gap-3"><Utensils size={21} className="text-marca" aria-hidden="true" /><span>Alimentação que cabe na sua rotina</span></div>
          <div className="flex items-center gap-3"><Dumbbell size={21} className="text-marca" aria-hidden="true" /><span>Seu treino, no mesmo lugar</span></div>
          <div className="flex items-center gap-3"><Check size={21} className="text-marca" aria-hidden="true" /><span>Mais clareza sobre seu progresso</span></div>
        </div>
      </section>
      <div className="auth-form">
        <header className="mb-8 flex items-center justify-between gap-4"><Logotipo /><SeletorAparencia compacto /></header>
        <div className="app-card sm:p-8">{children}</div>
        <p className="mt-6 text-center text-xs leading-relaxed text-suave">Seu cuidado começa com um passo.</p>
      </div>
    </main>
  );
}
