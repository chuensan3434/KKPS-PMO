type PageContainerProps = {
  title: string;
  description: string;
  children?: React.ReactNode;
};

export function PageContainer({ title, description, children }: Readonly<PageContainerProps>) {
  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
      <header className="pb-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[var(--success)]">Workspace</p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.035em] text-[var(--ink)] sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)] sm:text-base">{description}</p>
      </header>

      {children ?? (
        <section aria-label={`${title} content`} className="surface mt-8 border-dashed p-6 sm:p-8">
          <p className="text-sm leading-6 text-slate-500">This area is ready for future implementation.</p>
        </section>
      )}
    </div>
  );
}
