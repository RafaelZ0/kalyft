export function EmBreve({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <>
      <h1 className="page-heading">{titulo}</h1>
      <p className="page-intro">{texto}</p>
    </>
  );
}
