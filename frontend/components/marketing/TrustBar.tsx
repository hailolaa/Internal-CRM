"use client";

const stats = [
  { value: "£2.4M+", label: "Revenue tracked" },
  { value: "12,000+", label: "Leads managed" },
  { value: "340+", label: "Clinics audited" },
  { value: "94%", label: "Client retention" },
];

export default function TrustBar() {
  return (
    <section
      className="py-16 px-6"
      style={{
        backgroundColor: "#FAF8F5",
        borderTop: "1px solid rgba(0,0,0,0.04)",
        borderBottom: "1px solid rgba(0,0,0,0.04)",
      }}
    >
      <div className="max-w-6xl mx-auto">
        <p
          className="text-center text-xs font-semibold uppercase tracking-[0.2em] mb-10"
          style={{ color: "rgba(110,106,232,0.5)" }}
        >
          Trusted by clinic owners across the UK
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p
                className="text-3xl md:text-4xl font-bold tracking-tight"
                style={{ color: "#111111", letterSpacing: "-0.03em" }}
              >
                {stat.value}
              </p>
              <p className="text-sm mt-1.5" style={{ color: "#6B7280" }}>
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
