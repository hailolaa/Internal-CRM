const legend = [
  { label: "Revenue", color: "#6E6AE8" },
  { label: "Enquiries", color: "#A8B5A2" },
  { label: "Consultations", color: "#C2A87A" },
];

export default function RevenuePerformancePanel() {
  return (
    <div
      className="rounded-[28px] px-8 py-10 sm:px-10 sm:py-12"
      style={{
        backgroundColor: "#FDFCFA",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 1px 4px rgba(0,0,0,0.03), 0 4px 24px rgba(0,0,0,0.02)",
      }}
    >
      {/* Header */}
      <div className="mb-8">
        <div
          className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1 mb-4"
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
            Revenue Performance
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <h2
              className="text-2xl sm:text-3xl font-bold tracking-tight leading-snug"
              style={{ color: "#111111", letterSpacing: "-0.02em" }}
            >
              Revenue Performance
            </h2>
            <p
              className="mt-2 max-w-2xl text-sm sm:text-base leading-relaxed"
              style={{ color: "#6B7280" }}
            >
              View revenue movement, enquiry quality and booked consultation
              trends from one executive view.
            </p>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 shrink-0">
            {legend.map((item) => (
              <div key={item.label} className="flex items-center gap-1.5">
                <span
                  className="block h-2 w-2 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span className="text-xs" style={{ color: "#6B7280" }}>
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Chart area */}
      <div
        className="relative w-full rounded-[20px] overflow-hidden"
        style={{
          backgroundColor: "#FFFCF9",
          border: "1px solid rgba(0,0,0,0.05)",
          minHeight: "260px",
        }}
      >
        {/* Grid lines */}
        <svg
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Horizontal grid lines */}
          {[20, 40, 60, 80].map((pct) => (
            <line
              key={pct}
              x1="0"
              y1={`${pct}%`}
              x2="100%"
              y2={`${pct}%`}
              stroke="rgba(0,0,0,0.05)"
              strokeWidth="1"
            />
          ))}

          {/* Vertical grid lines */}
          {[16.6, 33.3, 50, 66.6, 83.3].map((pct) => (
            <line
              key={pct}
              x1={`${pct}%`}
              y1="0"
              x2={`${pct}%`}
              y2="100%"
              stroke="rgba(0,0,0,0.04)"
              strokeWidth="1"
            />
          ))}

          {/* Placeholder trend line — Revenue */}
          <polyline
            points="0,200 80,180 160,155 240,165 320,130 400,110 480,95 560,105 640,80 720,65 800,70"
            fill="none"
            stroke="#6E6AE8"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.25"
          />

          {/* Placeholder trend line — Enquiries */}
          <polyline
            points="0,210 80,195 160,185 240,190 320,170 400,155 480,145 560,150 640,130 720,115 800,120"
            fill="none"
            stroke="#A8B5A2"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.25"
          />

          {/* Placeholder trend line — Consultations */}
          <polyline
            points="0,220 80,210 160,200 240,205 320,190 400,180 480,172 560,178 640,160 720,148 800,152"
            fill="none"
            stroke="#C2A87A"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.25"
          />
        </svg>

        {/* Empty state overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center mb-1"
            style={{ backgroundColor: "rgba(110,106,232,0.07)" }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 12L6 8L9 11L14 5"
                stroke="#6E6AE8"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: "#111111" }}>
            Live revenue data will appear here
          </p>
          <p className="text-xs max-w-xs" style={{ color: "#6B7280" }}>
            once tracking is connected.
          </p>
        </div>
      </div>

      {/* X-axis month labels */}
      <div className="flex justify-between mt-3 px-1">
        {["Jan", "Feb", "Mar", "Apr", "May", "Jun"].map((m) => (
          <span
            key={m}
            className="text-xs"
            style={{ color: "#6B7280", opacity: 0.6 }}
          >
            {m}
          </span>
        ))}
      </div>
    </div>
  );
}
