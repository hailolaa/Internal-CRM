export default function RevenueHero() {
  return (
    <div
      className="w-full rounded-[28px] px-8 py-10 sm:px-12 sm:py-14"
      style={{
        backgroundColor: "#FDFCFA",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.03), 0 4px 24px rgba(0,0,0,0.02)",
      }}
    >
      <div
        className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 mb-6"
        style={{
          backgroundColor: "rgba(110,106,232,0.06)",
          border: "1px solid rgba(110,106,232,0.12)",
        }}
      >
        <span
          className="block h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "#6E6AE8" }}
        />
        <span
          className="text-xs font-medium tracking-wide"
          style={{ color: "#6E6AE8" }}
        >
          Clinic Growth Intelligence
        </span>
      </div>

      <h1
        className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight"
        style={{ color: "#111111", letterSpacing: "-0.025em" }}
      >
        Revenue Command Centre
      </h1>

      <p
        className="mt-3 max-w-2xl text-base sm:text-lg leading-relaxed"
        style={{ color: "#6B7280" }}
      >
        Track patient demand, booked consultations, call performance and revenue
        movement from one clear executive view.
      </p>
    </div>
  );
}
