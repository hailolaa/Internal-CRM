import type { CSSProperties, ReactNode } from "react";
import { formatProposalV5Money } from "../data/breakEven";
import { getProposalV5SelectedProofAssets } from "../data/proofValidation";
import type { ProposalV5ProofAsset, ProposalV5ScopeLine, ProposalV5Snapshot, ProposalV5Stated } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { evidenceStateLabel } from "./pageContentHelpers";

const { colors, type } = proposalV5Tokens;

export const v19Styles = {
  eyebrow: (dark = false): CSSProperties => ({
    margin: 0,
    color: dark ? colors.teal : colors.strongTeal,
    fontSize: type.legal,
    fontWeight: 800,
    letterSpacing: "0.1em",
    lineHeight: 1.2,
    textTransform: "uppercase",
  }),
  title: (dark = false): CSSProperties => ({
    margin: "3mm 0 0",
    color: dark ? colors.paper : colors.headingInk,
    fontSize: type.internalHeadline,
    fontWeight: 850,
    letterSpacing: 0,
    lineHeight: 1.02,
    overflowWrap: "anywhere",
  }),
  lede: (dark = false): CSSProperties => ({
    margin: "4mm 0 0",
    color: dark ? colors.rule : colors.muted,
    fontSize: type.lede,
    lineHeight: 1.32,
  }),
  body: (dark = false): CSSProperties => ({
    margin: 0,
    color: dark ? colors.rule : colors.headingInk,
    fontSize: type.body,
    lineHeight: 1.35,
  }),
  muted: (dark = false): CSSProperties => ({
    margin: 0,
    color: dark ? colors.rule : colors.muted,
    fontSize: "9.2pt",
    lineHeight: 1.32,
  }),
  panel: (dark = false): CSSProperties => ({
    borderTop: `0.45mm solid ${dark ? colors.teal : colors.rule}`,
    boxSizing: "border-box",
    paddingTop: "3.2mm",
  }),
  softPanel: (dark = false): CSSProperties => ({
    background: dark ? colors.secondaryDark : colors.card,
    border: `0.35mm solid ${dark ? "rgba(210, 222, 218, 0.22)" : colors.rule}`,
    borderRadius: "2.2mm",
    boxSizing: "border-box",
    padding: "4.6mm",
  }),
  grid2: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "6mm",
  } as CSSProperties,
  grid3: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "4mm",
  } as CSSProperties,
};

export function formatV19Date(value: string | null | undefined) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatV19Money(cents: number | null | undefined) {
  return typeof cents === "number" ? formatProposalV5Money(cents) : null;
}

export function safeV19Href(value: string | null | undefined, fallback: string) {
  const cleaned = String(value || "").trim();
  if (!cleaned) return fallback;
  if (cleaned.startsWith("#") || cleaned.startsWith("/") || cleaned.startsWith("mailto:")) return cleaned;
  try {
    const parsed = new URL(cleaned);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? cleaned : fallback;
  } catch {
    return fallback;
  }
}

export function compactTerm(months: number | null | undefined) {
  if (!months) return null;
  return `${months} month${months === 1 ? "" : "s"}`;
}

export function compactNotice(days: number | null | undefined) {
  if (!days) return null;
  return `${days} day${days === 1 ? "" : "s"}`;
}

export function statedValue<T>(stated: ProposalV5Stated<T> | null | undefined) {
  return stated?.value ?? null;
}

export function statedText(stated: ProposalV5Stated<string> | null | undefined) {
  return stated?.value || evidenceStateLabel(stated?.state || "to_confirm");
}

export function statedList(stated: ProposalV5Stated<string[]> | null | undefined) {
  return stated?.value?.length ? stated.value : [evidenceStateLabel(stated?.state || "to_confirm")];
}

export function primaryService(snapshot: ProposalV5Snapshot) {
  return statedList(snapshot.clinic.priorityServices)[0] || snapshot.clinic.typeShortLabel;
}

export function selectedProof(snapshot: ProposalV5Snapshot): ProposalV5ProofAsset[] {
  return getProposalV5SelectedProofAssets({
    clinic: {
      clinicType: snapshot.clinic.clinicType,
      proofTags: snapshot.clinic.proofTags,
    },
    proof: snapshot.proof,
  });
}

export function scopeByKeywords(snapshot: ProposalV5Snapshot, keywords: string[], limit = 5) {
  const normalized = keywords.map((keyword) => keyword.toLowerCase());
  const lines = snapshot.scope.filter((line) => {
    const haystack = [
      line.category,
      line.title,
      line.description,
      line.quantityLimit,
      line.frequency,
      line.exclusion,
      line.thirdPartyCosts,
    ].filter(Boolean).join(" ").toLowerCase();
    return normalized.some((keyword) => haystack.includes(keyword));
  });
  return (lines.length ? lines : snapshot.scope).slice(0, limit);
}

export function includedScope(snapshot: ProposalV5Snapshot, limit = 7) {
  const included = snapshot.scope.filter((line) => line.inclusionStatus !== "excluded");
  return (included.length ? included : snapshot.scope).slice(0, limit);
}

export function scopeLineSummary(line: ProposalV5ScopeLine) {
  return [
    line.frequency,
    line.quantityLimit,
    line.treatmentsAndLocations,
  ].filter(Boolean).join(" | ");
}

export function proofImageUrl(asset: ProposalV5ProofAsset | null | undefined) {
  const url = String(asset?.mediaUrl || "").trim();
  return url.startsWith("/") || /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?(#.*)?$/i.test(url) ? url : null;
}

export function missingIf(condition: unknown, label: string) {
  return condition ? [] : [label];
}

export function assertV19PageReady(pageName: string, missing: string[]) {
  if (missing.length > 0) {
    throw new Error(`${pageName} is missing required snapshot data: ${missing.join(", ")}`);
  }
}

export function V19Intro({
  eyebrow,
  title,
  lede,
  dark = false,
  width = "156mm",
}: {
  eyebrow: string;
  title: ReactNode;
  lede?: ReactNode;
  dark?: boolean;
  width?: string;
}) {
  return (
    <header style={{ maxWidth: width }}>
      <p style={v19Styles.eyebrow(dark)}>{eyebrow}</p>
      <h1 style={v19Styles.title(dark)}>{title}</h1>
      {lede ? <p style={v19Styles.lede(dark)}>{lede}</p> : null}
    </header>
  );
}

export function V19Panel({
  label,
  title,
  children,
  dark = false,
}: {
  label?: string;
  title: ReactNode;
  children?: ReactNode;
  dark?: boolean;
}) {
  return (
    <section style={v19Styles.panel(dark)}>
      {label ? <p style={v19Styles.eyebrow(dark)}>{label}</p> : null}
      <h2 style={{ margin: label ? "2mm 0 0" : 0, color: dark ? colors.paper : colors.headingInk, fontSize: "16pt", fontWeight: 850, lineHeight: 1.08 }}>
        {title}
      </h2>
      {children ? <div style={{ marginTop: "2.8mm" }}>{children}</div> : null}
    </section>
  );
}

export function V19Card({
  children,
  dark = false,
  mint = false,
  style,
}: {
  children: ReactNode;
  dark?: boolean;
  mint?: boolean;
  style?: CSSProperties;
}) {
  const background = dark ? colors.secondaryDark : mint ? colors.mint : colors.card;
  return (
    <section
      style={{
        background,
        border: dark ? `0.35mm solid rgba(210, 222, 218, 0.22)` : `0.35mm solid ${colors.rule}`,
        borderRadius: "2.5mm",
        boxSizing: "border-box",
        color: dark ? colors.paper : colors.headingInk,
        padding: "5mm",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

export function V19Rule({ dark = false, style }: { dark?: boolean; style?: CSSProperties }) {
  return <div style={{ height: "0.35mm", background: dark ? "rgba(210, 222, 218, 0.28)" : colors.rule, ...style }} />;
}

export function V19SmallLabel({ children, dark = false, color }: { children: ReactNode; dark?: boolean; color?: string }) {
  return (
    <p
      style={{
        margin: 0,
        color: color || (dark ? colors.teal : colors.strongTeal),
        fontSize: type.legal,
        fontWeight: 850,
        letterSpacing: "0.08em",
        lineHeight: 1.15,
        textTransform: "uppercase",
      }}
    >
      {children}
    </p>
  );
}

export function V19Body({ children, dark = false, muted = false, style }: { children: ReactNode; dark?: boolean; muted?: boolean; style?: CSSProperties }) {
  return (
    <p
      style={{
        margin: 0,
        color: muted ? (dark ? colors.rule : colors.muted) : dark ? colors.paper : colors.headingInk,
        fontSize: type.body,
        lineHeight: 1.34,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export function V19NumberedRows({
  rows,
  dark = false,
}: {
  rows: Array<{ label: ReactNode; body: ReactNode; accent?: boolean }>;
  dark?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: "3.2mm" }}>
      {rows.map((row, index) => (
        <div
          key={`${index}-${String(row.label)}`}
          style={{
            display: "grid",
            gridTemplateColumns: "10mm 1fr",
            gap: "3mm",
            borderTop: `0.35mm solid ${dark ? "rgba(210, 222, 218, 0.24)" : colors.rule}`,
            paddingTop: "3mm",
          }}
        >
          <strong style={{ color: row.accent ? colors.copper : dark ? colors.teal : colors.strongTeal, fontSize: "12pt", lineHeight: 1 }}>
            {String(index + 1).padStart(2, "0")}
          </strong>
          <div>
            <h3 style={{ margin: 0, color: dark ? colors.paper : colors.headingInk, fontSize: "11.2pt", lineHeight: 1.12 }}>{row.label}</h3>
            <p style={{ margin: "1.4mm 0 0", color: dark ? colors.rule : colors.muted, fontSize: "8.8pt", lineHeight: 1.25 }}>{row.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function V19CheckList({ items, dark = false }: { items: ReactNode[]; dark?: boolean }) {
  return (
    <ul style={{ display: "grid", gap: "2.6mm", listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item, index) => (
        <li key={`${index}-${String(item).slice(0, 20)}`} style={{ display: "grid", gridTemplateColumns: "6mm 1fr", gap: "2.5mm", alignItems: "start" }}>
          <span
            aria-hidden
            style={{
              width: "4.2mm",
              height: "4.2mm",
              marginTop: "0.4mm",
              borderRadius: "50%",
              background: dark ? colors.teal : colors.strongTeal,
              color: dark ? colors.deepInk : colors.card,
              display: "grid",
              placeItems: "center",
              fontSize: "6pt",
              fontWeight: 900,
            }}
          >
            ✓
          </span>
          <span style={{ color: dark ? colors.paper : colors.headingInk, fontSize: "9.4pt", lineHeight: 1.28, fontWeight: 700 }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function V19StageStrip({ stages, active }: { stages: string[]; active?: string | null }) {
  const normalizedActive = String(active || "").toLowerCase();
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "2.6mm" }}>
      {stages.slice(0, 8).map((stage, index) => {
        const isActive = normalizedActive && stage.toLowerCase() === normalizedActive;
        return (
          <div
            key={`${stage}-${index}`}
            style={{
              minHeight: "17mm",
              background: isActive ? colors.teal : index === 0 || index === stages.length - 1 ? colors.secondaryDark : "#123D40",
              border: `0.35mm solid ${isActive ? colors.teal : "rgba(210, 222, 218, 0.22)"}`,
              borderRadius: "1.8mm",
              boxSizing: "border-box",
              color: isActive ? colors.deepInk : colors.paper,
              display: "grid",
              alignContent: "center",
              gap: "1mm",
              padding: "2.4mm",
              textAlign: "center",
            }}
          >
            <strong style={{ color: isActive ? colors.deepInk : colors.teal, fontSize: "7pt", lineHeight: 1 }}>{String(index + 1).padStart(2, "0")}</strong>
            <span style={{ fontSize: "7.5pt", fontWeight: 850, lineHeight: 1.08, textTransform: "uppercase" }}>{stage}</span>
          </div>
        );
      })}
    </div>
  );
}

export function V19List({ items, dark = false }: { items: ReactNode[]; dark?: boolean }) {
  return (
    <ul style={{ display: "grid", gap: "2.3mm", margin: 0, padding: 0, listStyle: "none" }}>
      {items.map((item, index) => (
        <li
          key={`${index}-${String(item).slice(0, 20)}`}
          style={{
            display: "grid",
            gridTemplateColumns: "6mm 1fr",
            gap: "2.5mm",
            color: dark ? colors.rule : colors.headingInk,
            fontSize: "10.5pt",
            lineHeight: 1.28,
          }}
        >
          <span style={{ color: dark ? colors.teal : colors.strongTeal, fontWeight: 850 }}>{index + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function V19ValueGrid({
  values,
  dark = false,
  columns = 3,
}: {
  values: Array<{ label: string; value: ReactNode; note?: ReactNode }>;
  dark?: boolean;
  columns?: 2 | 3 | 4;
}) {
  return (
    <dl style={{ display: "grid", gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: "3.2mm", margin: 0 }}>
      {values.map((item) => (
        <div key={item.label} style={v19Styles.softPanel(dark)}>
          <dt style={v19Styles.eyebrow(dark)}>{item.label}</dt>
          <dd style={{ margin: "2mm 0 0", color: dark ? colors.paper : colors.headingInk, fontSize: "15pt", fontWeight: 850, lineHeight: 1.05 }}>
            {item.value}
          </dd>
          {item.note ? <p style={{ ...v19Styles.muted(dark), marginTop: "1.6mm" }}>{item.note}</p> : null}
        </div>
      ))}
    </dl>
  );
}

export function V19ScopeRows({ lines, dark = false, max = 5 }: { lines: ProposalV5ScopeLine[]; dark?: boolean; max?: number }) {
  return (
    <div style={{ display: "grid", gap: "2.4mm" }}>
      {lines.slice(0, max).map((line, index) => (
        <div
          key={`${line.category || "scope"}-${line.title || index}`}
          style={{
            display: "grid",
            gridTemplateColumns: "45mm 1fr 38mm",
            gap: "3mm",
            borderTop: `0.35mm solid ${dark ? "rgba(210, 222, 218, 0.24)" : colors.rule}`,
            paddingTop: "2.4mm",
          }}
        >
          <strong style={{ color: dark ? colors.paper : colors.headingInk, fontSize: "10pt", lineHeight: 1.16 }}>{line.title}</strong>
          <span style={{ color: dark ? colors.rule : colors.headingInk, fontSize: "8.7pt", lineHeight: 1.24 }}>{line.description}</span>
          <span style={{ color: dark ? colors.teal : colors.strongTeal, fontSize: "8.2pt", fontWeight: 800, lineHeight: 1.2 }}>
            {[scopeLineSummary(line), line.exclusion, line.thirdPartyCosts].filter(Boolean).join(" | ") || line.inclusionStatus || "Included"}
          </span>
        </div>
      ))}
    </div>
  );
}

export function V19ImageFrame({
  url,
  alt,
  height = "58mm",
  mode = "cover",
}: {
  url: string;
  alt: string;
  height?: string;
  mode?: "cover" | "contain";
}) {
  return (
    <figure
      aria-label={alt}
      role="img"
      style={{
        width: proposalV5Tokens.page.contentWidth,
        height,
        margin: 0,
        backgroundImage: `url("${url}")`,
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundSize: mode,
        border: `0.35mm solid ${colors.rule}`,
        boxSizing: "border-box",
      }}
    />
  );
}
