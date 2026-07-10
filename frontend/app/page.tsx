import Link from "next/link";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#eaedeb] px-6 py-10 text-[#151f21]">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl flex-col justify-between">
        <nav className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold">ClinicGrower Mission Control</p>
            <p className="text-xs text-[#5e8a8d]">Internal CRM</p>
          </div>
          <Link
            href="/login"
            className="rounded-xl border border-[#d8ddda] bg-[#FFFCF9] px-4 py-2 text-sm font-semibold hover:bg-white"
          >
            Sign in
          </Link>
        </nav>

        <section className="max-w-3xl py-20">
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">
            Internal operations workspace
          </p>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            One CRM for sales pipeline, client accounts, and delivery work.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[#5e8a8d]">
            Mission Control is the internal system for ClinicGrower team members
            to manage prospects, accounts, tasks, projects, and daily operations.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/login"
              className="rounded-xl bg-[#5e8a8d] px-5 py-3 text-sm font-semibold text-white hover:bg-[#507b7e]"
            >
              Open Mission Control
            </Link>
            <Link
              href="/app"
              className="rounded-xl border border-[#d8ddda] bg-[#FFFCF9] px-5 py-3 text-sm font-semibold hover:bg-white"
            >
              Go to dashboard
            </Link>
          </div>
        </section>

        <div className="grid gap-3 pb-8 sm:grid-cols-3">
          {["Sales pipeline", "Client delivery", "Internal tasks"].map((item) => (
            <div
              key={item}
              className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FFFCF9] p-4 text-sm font-semibold"
            >
              {item}
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
