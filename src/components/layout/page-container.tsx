type PageContainerProps = {
  title: string;
  description: string;
};

export function PageContainer({ title, description }: Readonly<PageContainerProps>) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
      <header className="border-b border-slate-200 pb-6">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-700">KKPS PMO</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">{description}</p>
      </header>

      <section aria-label={`${title} content`} className="mt-8 rounded-xl border border-dashed border-slate-300 bg-white p-6 sm:p-8">
        <p className="text-sm leading-6 text-slate-500">This area is ready for future implementation.</p>
      </section>
    </div>
  );
}
