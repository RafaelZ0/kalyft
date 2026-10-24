import { Logotipo } from "@/lib/marca";

export default function LayoutEntrar({ children }: LayoutProps<"/entrar">) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pt-[max(4rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <header className="flex flex-col items-center text-center">
        <Logotipo className="text-[clamp(3rem,17vw,4.75rem)]" />
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-suave">
          Seu treino. Sua rotina.
          <br />
          Em um só lugar.
        </p>
      </header>
      <div className="mt-12 flex-1">{children}</div>
    </main>
  );
}
