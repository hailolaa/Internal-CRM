"use client";

// ============================================================
// Skeleton Loaders — loading state placeholders
// ============================================================

export function SkeletonLine({ className = "" }: { className?: string }) {
  return <div className={`h-4 rounded skeleton-shimmer ${className}`} />;
}

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return <div className={`rounded-[24px] skeleton-shimmer ${className}`} />;
}

// ============================================================
// StatCardSkeleton — matches StatCard layout
// ============================================================
export function StatCardSkeleton() {
  return (
    <div
      className="rounded-[24px] p-4 skeleton-card-loading"
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="w-8 h-8 rounded-lg skeleton-shimmer" />
        <div className="w-12 h-4 rounded skeleton-shimmer" />
      </div>
      <div className="w-20 h-7 rounded mb-1 skeleton-shimmer" />
      <div className="w-16 h-3 rounded skeleton-shimmer" />
    </div>
  );
}

// ============================================================
// TableRowSkeleton — matches DataTable row layout
// ============================================================
export function TableRowSkeleton({ columns = 6 }: { columns?: number }) {
  return (
    <tr style={{ borderBottom: "1px solid rgba(21,31,33,0.06)" }}>
      {Array.from({ length: columns }, (_, i) => (
        <td key={i} className="px-5 py-4">
          <div
            className={`h-4 rounded skeleton-shimmer ${i === 0 ? "w-32" : "w-20"}`}
          />
        </td>
      ))}
    </tr>
  );
}

export function TableSkeleton({
  rows = 5,
  columns = 6,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div
      className="rounded-[24px] overflow-hidden"
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-3 flex gap-6"
        style={{ borderBottom: "1px solid rgba(21,31,33,0.06)" }}
      >
        {Array.from({ length: columns }, (_, i) => (
          <div
            key={i}
            className="h-3 rounded skeleton-shimmer w-16"
          />
        ))}
      </div>
      {/* Rows */}
      <table className="w-full">
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <TableRowSkeleton key={i} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================
// CardSkeleton — matches Card layout
// ============================================================
export function CardSkeleton({
  lines = 4,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-[24px] p-5 skeleton-card-loading ${className}`}
      style={{
        backgroundColor: "#FFFCF9",
        border: "1px solid rgba(21,31,33,0.06)",
      }}
    >
      <div className="w-32 h-5 rounded mb-4 skeleton-shimmer" />
      <div className="space-y-3">
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className={`h-4 rounded skeleton-shimmer ${i === lines - 1 ? "w-3/4" : "w-full"}`}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================
// PageSkeleton — full page loading skeleton
// ============================================================
export function PageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="w-48 h-7 rounded mb-2 skeleton-shimmer" />
          <div className="w-64 h-4 rounded skeleton-shimmer" />
        </div>
        <div className="w-32 h-10 rounded-lg skeleton-shimmer" />
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Table */}
      <TableSkeleton rows={6} columns={5} />
    </div>
  );
}

// ============================================================
// PipelineSkeleton — pipeline board loading state
// ============================================================
export function PipelineSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {Array.from({ length: columns }, (_, i) => (
        <div key={i} className="flex-shrink-0 w-72">
          <div className="flex items-center gap-2 mb-3 px-1">
            <div className="w-3 h-3 rounded-full skeleton-shimmer" />
            <div className="w-24 h-4 rounded skeleton-shimmer" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 2 + (i % 2) }, (_, j) => (
              <div
                key={j}
                className="rounded-[24px] p-4 skeleton-card-loading"
                style={{
                  backgroundColor: "#FFFCF9",
                  border: "1px solid rgba(21,31,33,0.06)",
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-9 h-9 rounded-full skeleton-shimmer" />
                  <div className="flex-1">
                    <div className="w-24 h-4 rounded mb-1 skeleton-shimmer" />
                    <div className="w-16 h-3 rounded skeleton-shimmer" />
                  </div>
                </div>
                <div className="w-full h-3 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
