"use client";

import { useId } from "react";
import { Search } from "lucide-react";

// ============================================================
// FormField — reusable form input with brand palette
// ============================================================
export function FormField({
  id,
  label,
  value,
  onChange,
  placeholder = "",
  type = "text",
  icon: Icon,
  required = false,
  rows = 4,
  options,
  hint,
  className = "",
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?:
    | "text"
    | "email"
    | "tel"
    | "number"
    | "url"
    | "date"
    | "time"
    | "password"
    | "textarea"
    | "select";
  icon?: React.ComponentType<{ className?: string }>;
  required?: boolean;
  rows?: number;
  options?: { value: string; label: string }[];
  hint?: string;
  className?: string;
}) {
  const generatedId = useId();
  const fieldId = id ?? generatedId;
  const baseInput =
    "w-full bg-[#FFFCF9] border border-[rgba(21,31,33,0.08)] rounded-2xl px-4 py-3.5 text-sm text-[#151f21] outline-none transition-all duration-200 placeholder:text-[#A8A39B] focus:border-[#60b4af] focus:ring-2 focus:ring-[rgba(96,180,175,0.12)]";
  const withIcon = Icon ? "pl-11" : "";

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    onChange(e.target.value);
  };

  return (
    <div className={className}>
      <label
        htmlFor={fieldId}
        className="block text-[13px] font-medium mb-2"
        style={{ color: "#151f21" }}
      >
        {label}
        {required && <span className="text-[#9a5524] ml-0.5">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A39B]" />
        )}
        {type === "textarea" ? (
          <textarea
            id={fieldId}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            rows={rows}
            required={required}
            className={`${baseInput} ${withIcon} resize-none`}
          />
        ) : type === "select" ? (
          <select
            id={fieldId}
            value={value}
            onChange={handleChange}
            required={required}
            className={`${baseInput} ${withIcon}`}
          >
            <option value="">Select...</option>
            {options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            id={fieldId}
            type={type}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            required={required}
            className={`${baseInput} ${withIcon}`}
          />
        )}
      </div>
      {hint && (
        <p className="text-xs mt-1.5" style={{ color: "#5e8a8d" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

// ============================================================
// SearchInput — search bar with icon
// ============================================================
export function SearchInput({
  id,
  name,
  value,
  onChange,
  placeholder = "Search...",
  ariaLabel,
  className = "",
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputName = name ?? inputId;

  return (
    <div className={`relative ${className}`}>
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8A39B]" />
      <input
        id={inputId}
        name={inputName}
        type="text"
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-[#FFFCF9] border border-[rgba(21,31,33,0.06)] rounded-2xl pl-10 pr-4 py-3 text-sm text-[#151f21] outline-none transition-all duration-200 placeholder:text-[#A8A39B] focus:border-[#60b4af] focus:ring-2 focus:ring-[rgba(96,180,175,0.12)]"
        style={{ boxShadow: "0 1px 3px rgba(21,31,33,0.03)" }}
      />
    </div>
  );
}

// ============================================================
// FilterTabs — horizontal tab filter
// ============================================================
export function FilterTabs({
  tabs,
  active,
  onChange,
}: {
  tabs: string[];
  active: string;
  onChange: (tab: string) => void;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {tabs.map((tab) => {
        const isActive = active === tab.toLowerCase();
        return (
          <button
            key={tab}
            onClick={() => onChange(tab.toLowerCase())}
            className="px-4 py-2.5 rounded-2xl text-sm whitespace-nowrap transition-all duration-200 font-medium"
            style={{
              backgroundColor: isActive
                ? "rgba(96, 180, 175, 0.08)"
                : "#FFFCF9",
              color: isActive ? "#60b4af" : "#5e8a8d",
              border: isActive
                ? "1px solid rgba(96, 180, 175, 0.18)"
                : "1px solid rgba(21,31,33,0.06)",
              boxShadow: isActive ? "none" : "0 1px 3px rgba(21,31,33,0.03)",
            }}
          >
            {tab}
          </button>
        );
      })}
    </div>
  );
}
