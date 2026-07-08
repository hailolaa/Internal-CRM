"use client";

// ============================================================
// Toggle — reusable toggle switch (accent green, luxury aesthetic)
// ============================================================
export function Toggle({
  enabled,
  onChange,
  size = "md",
}: {
  enabled: boolean;
  onChange?: (value: boolean) => void;
  size?: "sm" | "md";
}) {
  const sizeStyles =
    size === "sm"
      ? { track: "w-8 h-4", thumb: "w-3 h-3", on: "right-0.5", off: "left-0.5" }
      : {
          track: "w-10 h-5",
          thumb: "w-4 h-4",
          on: "right-0.5",
          off: "left-0.5",
        };

  return (
    <button
      type="button"
      onClick={() => onChange?.(!enabled)}
      className={`${sizeStyles.track} rounded-full relative cursor-pointer transition-all duration-300 ease-in-out focus:outline-none`}
      style={{
        backgroundColor: enabled ? "#60b4af" : "#d8ddda",
        boxShadow: enabled
          ? "0 1px 4px rgba(96, 180, 175, 0.25)"
          : "0 1px 3px rgba(21, 31, 33, 0.08)",
      }}
    >
      <div
        className={`${sizeStyles.thumb} rounded-full absolute ${enabled ? sizeStyles.on : sizeStyles.off} top-0.5 transition-all duration-300 ease-in-out`}
        style={{
          backgroundColor: "white",
          boxShadow: "0 1px 3px rgba(21, 31, 33, 0.12)",
        }}
      />
    </button>
  );
}

// ============================================================
// SettingRow — label + description + control
// ============================================================
export function SettingRow({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex items-center justify-between py-3 last:border-0"
      style={{ borderBottom: "1px solid #d8ddda" }}
    >
      <div>
        <p className="font-medium text-sm" style={{ color: "#151f21" }}>
          {title}
        </p>
        {description && (
          <p className="text-xs" style={{ color: "#5e8a8d" }}>
            {description}
          </p>
        )}
      </div>
      {children}
    </div>
  );
}
