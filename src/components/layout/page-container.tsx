type PageContainerProps = {
  title: string;
  description: string;
  eyebrow?: string;
  children?: React.ReactNode;
};

export function PageContainer({ title, description, eyebrow = "Workspace", children }: Readonly<PageContainerProps>) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--success)]">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.035em] text-[var(--ink)] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>
      </header>

      {children ?? (
        <section aria-label={`${title} content`} className="surface mt-2 overflow-hidden p-0">
          <div className="grid min-h-56 place-items-center bg-[radial-gradient(circle_at_top_left,rgba(225,243,94,0.2),transparent_52%)] p-8 text-center">
            <div><span aria-hidden="true" className="mx-auto grid size-12 place-items-center rounded-2xl bg-[var(--surface-subtle)] text-xl text-[var(--muted)]">◇</span><p className="mt-4 font-extrabold text-[var(--ink)]">Workspace ready</p><p className="mt-1 max-w-md text-sm leading-6 text-[var(--muted)]">This area is intentionally reserved for existing functionality planned in a later phase.</p></div>
          </div>
        </section>
      )}
    </div>
  );
}
