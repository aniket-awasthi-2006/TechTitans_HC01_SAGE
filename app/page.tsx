export default function Home() {
  return (
    <div className="min-h-screen bg-white text-slate-950 font-sans dark:bg-slate-950 dark:text-white">
      <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-10 py-8 sm:px-14 lg:px-20">
        <header className="mb-8 flex items-center justify-between border-b border-slate-200/70 pb-4 dark:border-white/10">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
              OPD Queue System
            </p>
          </div>
          <div className="text-right text-sm text-slate-600 dark:text-slate-500">
            <p>Hospital OPD Display</p>
          </div>
        </header>

        <main className="grid flex-1 gap-8 lg:grid-cols-[1.6fr_1fr] xl:grid-cols-[1.8fr_1fr]">
          <section className="flex flex-col justify-between rounded-3xl bg-slate-100/90 p-8 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/40 dark:bg-slate-900/90 dark:shadow-[0_40px_120px_-40px_rgba(15,23,42,0.8)] dark:ring-white/10 sm:p-10">
            <div className="space-y-8">
              <div className="flex items-center gap-3">
                <span className="inline-flex rounded-full bg-emerald-100/90 px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  Now Serving
                </span>
              </div>
              <div className="space-y-4">
                <p className="text-[8rem] font-black leading-none tracking-tight text-emerald-600 sm:text-[9.5rem] lg:text-[10.5rem] dark:text-emerald-400">
                  A102
                </p>
                <div className="space-y-2">
                  <p className="text-4xl font-semibold text-slate-950 sm:text-5xl dark:text-slate-100">
                    Robert J. Henderson
                  </p>
                  <p className="text-base text-slate-500 sm:text-lg dark:text-slate-400">
                    Proceed to Examination Room 04
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white/90 p-6 shadow-[0_20px_60px_-20px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-slate-950/90 dark:shadow-[0_20px_60px_-20px_rgba(15,23,42,0.9)]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                    Next patient estimated
                  </p>
                  <p className="mt-2 text-3xl font-semibold text-slate-950 sm:text-4xl dark:text-slate-100">
                    12 minutes
                  </p>
                </div>
                <div className="rounded-2xl bg-amber-100/90 px-4 py-3 text-amber-800 shadow-[0_6px_18px_-10px_rgba(251,191,36,0.25)] dark:bg-amber-500/10 dark:text-amber-300 dark:shadow-[0_6px_18px_-10px_rgba(251,191,36,0.9)] sm:px-5">
                  <p className="text-sm uppercase tracking-[0.24em] text-amber-800 dark:text-amber-100">
                    Estimated wait time
                  </p>
                  <p className="mt-1 text-xl font-semibold text-amber-900 dark:text-amber-200">
                    Next in 12 minutes
                  </p>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-3xl border border-slate-200/70 bg-slate-100/90 p-8 shadow-[0_40px_120px_-40px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-900/90 dark:shadow-[0_40px_120px_-40px_rgba(15,23,42,0.8)] sm:p-10">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Waiting Queue
                </p>
                <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-slate-100">
                  Next in line
                </p>
              </div>
              <div className="rounded-full bg-slate-200/80 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-700 dark:bg-white/5 dark:text-slate-400">
                6 total
              </div>
            </div>

            <div className="space-y-4">
              {[
                { token: "B205", name: "Jane Smith" },
                { token: "A103", name: "Samuel T. Porter" },
                { token: "C044", name: "Elena Rodriguez" },
                { token: "B206", name: "Michael Chen" },
                { token: "A104", name: "Linda G. Watson" },
              ].map((item) => (
                <div key={item.token} className="flex items-center justify-between rounded-3xl border border-slate-200/70 bg-white/80 px-5 py-4 dark:border-white/5 dark:bg-white/5">
                  <div>
                    <p className="text-lg font-semibold text-slate-950 dark:text-slate-100">
                      {item.token}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {item.name}
                    </p>
                  </div>
                  <span className="text-sm uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                    waiting
                  </span>
                </div>
              ))}
            </div>
          </aside>
        </main>
      </div>
    </div>
  );
}
