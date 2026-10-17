import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-24">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">Beatmap</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Upload your customer sheet. See where you&apos;re covered, and where you&apos;re not.
      </h1>
      <p className="max-w-xl text-lg text-slate-600">
        Map dealers, accounts and reps from a spreadsheet in minutes. US ZIP codes and UK postcodes built in. No GIS
        analyst, no enterprise contract.
      </p>
      <div>
        <Link
          href="/login"
          className="inline-flex rounded-md bg-slate-900 px-5 py-3 text-sm font-medium text-white hover:bg-slate-700"
        >
          Start free
        </Link>
      </div>
    </main>
  );
}
