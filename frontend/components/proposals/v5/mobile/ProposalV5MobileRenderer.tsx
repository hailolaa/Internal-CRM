import type { CSSProperties, ReactNode } from "react";
import { calculateProposalV5BreakEven, formatProposalV5Money } from "../data/breakEven";
import { getProposalV5SelectedProofAssets } from "../data/proofValidation";
import type {
  ProposalV5Image,
  ProposalV5PageId,
  ProposalV5ProofAsset,
  ProposalV5RenderableRendererProps,
  ProposalV5RendererProps,
  ProposalV5Snapshot,
  ProposalV5ScopeLine,
  ProposalV5Stated,
} from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { evidenceStateLabel } from "../pages/pageContentHelpers";
import { isProposalV5RenderableSnapshot } from "../renderer/ProposalV5Renderer";
import { proposalV5MobileSections, type ProposalV5MobileSectionId } from "./mobileSectionRegistry";

const colors = proposalV5Tokens.colors;

const styles = {
  root: {
    "--proposal-v5-mobile-max-width": "760px",
    color: colors.headingInk,
    background: colors.paper,
    fontFamily: proposalV5Tokens.font.family,
    lineHeight: 1.55,
    margin: "0 auto",
    maxWidth: "var(--proposal-v5-mobile-max-width)",
    overflowX: "hidden",
    width: "100%",
  } as CSSProperties,
  chapter: {
    borderTop: `1px solid ${colors.rule}`,
    padding: "28px 18px",
  } as CSSProperties,
  darkChapter: {
    background: colors.deepInk,
    borderTop: `1px solid ${colors.secondaryDark}`,
    color: colors.paper,
  } as CSSProperties,
  eyebrow: {
    color: colors.strongTeal,
    fontSize: "0.72rem",
    fontWeight: 800,
    letterSpacing: "0.12em",
    margin: "0 0 10px",
    textTransform: "uppercase",
  } as CSSProperties,
  darkEyebrow: {
    color: colors.teal,
  } as CSSProperties,
  h1: {
    color: "inherit",
    fontSize: "clamp(2rem, 12vw, 4.15rem)",
    fontWeight: 850,
    letterSpacing: 0,
    lineHeight: 0.95,
    margin: "0",
    overflowWrap: "anywhere",
  } as CSSProperties,
  h2: {
    color: "inherit",
    fontSize: "clamp(1.72rem, 8vw, 2.7rem)",
    fontWeight: 820,
    letterSpacing: 0,
    lineHeight: 1.03,
    margin: "0 0 14px",
    overflowWrap: "anywhere",
  } as CSSProperties,
  h3: {
    color: "inherit",
    fontSize: "1.05rem",
    fontWeight: 800,
    lineHeight: 1.18,
    margin: "0 0 8px",
  } as CSSProperties,
  body: {
    color: colors.headingInk,
    fontSize: "0.98rem",
    margin: 0,
  } as CSSProperties,
  muted: {
    color: colors.muted,
  } as CSSProperties,
  darkMuted: {
    color: "#B8CECE",
  } as CSSProperties,
  panel: {
    border: `1px solid ${colors.rule}`,
    borderRadius: 0,
    padding: "16px",
  } as CSSProperties,
  darkPanel: {
    background: colors.secondaryDark,
    border: `1px solid rgba(200, 223, 221, 0.26)`,
  } as CSSProperties,
  grid: {
    display: "grid",
    gap: "12px",
  } as CSSProperties,
  action: {
    alignItems: "center",
    borderRadius: 0,
    display: "inline-flex",
    fontSize: "0.95rem",
    fontWeight: 800,
    justifyContent: "center",
    minHeight: "48px",
    padding: "13px 16px",
    textDecoration: "none",
  } as CSSProperties,
} as const;

function compactDate(value: string | null) {
  if (!value) return "To confirm";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

function compactMonths(value: number | null) {
  if (value === null) return "To confirm";
  return `${value} month${value === 1 ? "" : "s"}`;
}

function compactDays(value: number | null) {
  if (value === null) return "To confirm";
  return `${value} day${value === 1 ? "" : "s"}`;
}

function statedText(value: ProposalV5Stated<string>) {
  return value.value || evidenceStateLabel(value.state);
}

function statedList(value: ProposalV5Stated<string[]>) {
  return value.value?.length ? value.value : [evidenceStateLabel(value.state)];
}

function statePill(state: ProposalV5Stated<unknown>["state"], dark = false) {
  return (
    <span
      style={{
        border: `1px solid ${dark ? "rgba(87, 187, 182, 0.45)" : colors.rule}`,
        color: dark ? colors.teal : colors.strongTeal,
        display: "inline-flex",
        fontSize: "0.68rem",
        fontWeight: 800,
        letterSpacing: "0.08em",
        padding: "5px 8px",
        textTransform: "uppercase",
      }}
    >
      {evidenceStateLabel(state)}
    </span>
  );
}

function safeLink(value: string | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("#") || trimmed.startsWith("/") || trimmed.startsWith("mailto:")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? trimmed : null;
  } catch {
    return null;
  }
}

function pageAnchorAttributes(pageId: ProposalV5PageId) {
  return {
    id: pageId,
    "data-v5-page-id": pageId,
  };
}

function Chapter({
  id,
  pageIds,
  dark = false,
  eyebrow,
  title,
  children,
}: {
  id: ProposalV5MobileSectionId;
  pageIds: ProposalV5PageId[];
  dark?: boolean;
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      data-v5-mobile-section-id={id}
      data-v5-page-ids={pageIds.join(" ")}
      style={{
        ...styles.chapter,
        ...(dark ? styles.darkChapter : null),
      }}
    >
      <p style={{ ...styles.eyebrow, ...(dark ? styles.darkEyebrow : null) }}>{eyebrow}</p>
      <h2 style={styles.h2}>{title}</h2>
      <div style={{ ...styles.grid, gap: "14px" }}>{children}</div>
    </section>
  );
}

function InlineImage({ image, ratio = "62%" }: { image: ProposalV5Image | null | undefined; ratio?: string }) {
  if (!image?.url) return null;
  return (
    <div
      aria-label={image.alt || "ClinicGrower proposal image"}
      role="img"
      style={{
        backgroundColor: colors.softPanel,
        backgroundImage: `url("${image.url}")`,
        backgroundPosition: image.cropPosition || "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        border: `1px solid ${colors.rule}`,
        minHeight: "220px",
        paddingTop: ratio,
        width: "100%",
      }}
    />
  );
}

function KeyValue({
  label,
  value,
  dark = false,
}: {
  label: string;
  value: ReactNode;
  dark?: boolean;
}) {
  return (
    <div style={{ ...styles.panel, ...(dark ? styles.darkPanel : null), minWidth: 0 }}>
      <span
        style={{
          color: dark ? "#B8CECE" : colors.muted,
          display: "block",
          fontSize: "0.68rem",
          fontWeight: 800,
          letterSpacing: "0.08em",
          marginBottom: "5px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <strong style={{ color: "inherit", display: "block", fontSize: "0.98rem", overflowWrap: "anywhere" }}>{value}</strong>
    </div>
  );
}

function TextPanel({
  title,
  text,
  state,
  dark = false,
}: {
  title: string;
  text: ReactNode;
  state?: ProposalV5Stated<unknown>["state"];
  dark?: boolean;
}) {
  return (
    <div style={{ ...styles.panel, ...(dark ? styles.darkPanel : null) }}>
      <div style={{ alignItems: "start", display: "flex", gap: "10px", justifyContent: "space-between" }}>
        <h3 style={styles.h3}>{title}</h3>
        {state ? statePill(state, dark) : null}
      </div>
      <div style={{ color: dark ? "#DCE9E8" : colors.headingInk, fontSize: "0.94rem", overflowWrap: "anywhere" }}>{text}</div>
    </div>
  );
}

function ListItems({
  items,
  dark = false,
}: {
  items: ReactNode[];
  dark?: boolean;
}) {
  return (
    <ul style={{ display: "grid", gap: "9px", listStyle: "none", margin: 0, padding: 0 }}>
      {items.map((item, index) => (
        <li
          key={index}
          style={{
            alignItems: "baseline",
            color: dark ? "#DCE9E8" : colors.headingInk,
            display: "grid",
            gap: "9px",
            gridTemplateColumns: "12px 1fr",
            minWidth: 0,
          }}
        >
          <span aria-hidden="true" style={{ background: colors.teal, display: "block", height: "2px", marginTop: "0.72em", width: "12px" }} />
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function MobileCover({ snapshot }: ProposalV5RendererProps) {
  const page = proposalV5MobileSections[0];
  return (
    <section
      {...pageAnchorAttributes("V5Page01Cover")}
      data-v5-mobile-section-id={page.id}
      data-v5-page-ids={page.pageIds.join(" ")}
      style={{
        ...styles.chapter,
        ...styles.darkChapter,
        paddingBottom: "34px",
        paddingTop: "24px",
      }}
    >
      <div style={{ display: "grid", gap: "18px" }}>
        <div style={{ color: colors.paper, fontSize: "1.02rem", fontWeight: 850, letterSpacing: "-0.01em" }}>ClinicGrower</div>
        <InlineImage image={snapshot.assets.sectorImages.cover} ratio="54%" />
        <div>
          <p style={{ ...styles.eyebrow, ...styles.darkEyebrow }}>Personalised growth proposal</p>
          <h1 style={styles.h1}>{snapshot.clinic.name.value}</h1>
          <p style={{ color: "#DCE9E8", fontSize: "1.05rem", margin: "14px 0 0", overflowWrap: "anywhere" }}>
            {statedText(snapshot.discovery.goal)}
          </p>
        </div>
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
          <KeyValue label="Location" value={statedText(snapshot.clinic.location)} dark />
          <KeyValue label="Prepared for" value={statedText(snapshot.recipient.name)} dark />
          <KeyValue label="Programme" value={snapshot.selectedPackage.name || "To confirm"} dark />
          <KeyValue label="Valid until" value={compactDate(snapshot.lifecycle.expiresAt)} dark />
          <KeyValue label="Reference" value={snapshot.proposal.reference} dark />
        </div>
      </div>
    </section>
  );
}

function MobileEvidence({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[1];
  const leaks = statedList(snapshot.journey.diagnosedLeaks);
  return (
    <Chapter id={section.id} pageIds={section.pageIds} eyebrow="Evidence and diagnosis" title="What needs to be true before more demand is scaled">
      <div {...pageAnchorAttributes("V5Page02EvidenceQuestions")}>
        <TextPanel
          title="Owner evidence questions"
          text={
            <ListItems
              items={[
                snapshot.journey.demandQuestion,
                snapshot.journey.progressionQuestion,
                "Can the team see enquiry progression through to recorded value?",
                "Is one named action clear from the evidence trail?",
              ]}
            />
          }
        />
      </div>
      <div {...pageAnchorAttributes("V5Page03EvidenceTrail")}>
        <TextPanel
          title="One evidence trail"
          text={statedText(snapshot.discovery.customerWording)}
          state={snapshot.discovery.customerWording.state}
        />
      </div>
      <div {...pageAnchorAttributes("V5Page04CommercialDiagnosis")}>
        <TextPanel
          title="Diagnosed commercial leaks"
          text={<ListItems items={[snapshot.journey.activeConstraint.value || evidenceStateLabel(snapshot.journey.activeConstraint.state), ...leaks]} />}
          state={snapshot.journey.activeConstraint.state}
        />
      </div>
    </Chapter>
  );
}

function MobilePartner({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[2];
  const videoUrl = safeLink(snapshot.links.videoUrl);
  return (
    <Chapter id={section.id} pageIds={section.pageIds} dark eyebrow={snapshot.narrative.partnerProposition.eyebrow} title={snapshot.narrative.partnerProposition.headline}>
      <div {...pageAnchorAttributes("V5Page05PartnerProposition")} style={{ display: "grid", gap: "14px" }}>
        <p style={{ color: "#DCE9E8", fontSize: "1rem", margin: 0 }}>{snapshot.narrative.partnerProposition.lede}</p>
        <InlineImage image={snapshot.assets.founderVideoThumbnail} ratio="58%" />
        {videoUrl ? (
          <a
            href={videoUrl}
            style={{
              ...styles.action,
              background: colors.teal,
              color: colors.deepInk,
            }}
          >
            {snapshot.narrative.partnerProposition.videoCtaLabel}
          </a>
        ) : null}
        <TextPanel title={snapshot.narrative.partnerProposition.founderLabel} text={snapshot.narrative.partnerProposition.credentialStatement} dark />
      </div>
    </Chapter>
  );
}

function MobileOperatingSystem({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[3];
  return (
    <Chapter id={section.id} pageIds={section.pageIds} eyebrow="Operating system" title={snapshot.narrative.systemsFit.headline}>
      <div {...pageAnchorAttributes("V5Page06SystemsFit")}>
        <TextPanel title="Fits the current clinic environment" text={snapshot.narrative.systemsFit.lede} />
      </div>
      <div {...pageAnchorAttributes("V5Page07DemandProgression")}>
        <TextPanel title="Patient and revenue journey" text={<ListItems items={snapshot.journey.stages} />} />
      </div>
      <div {...pageAnchorAttributes("V5Page08ResponseOwnership")}>
        <TextPanel
          title="Response ownership"
          text={snapshot.journey.activeConstraint.value || evidenceStateLabel(snapshot.journey.activeConstraint.state)}
          state={snapshot.journey.activeConstraint.state}
        />
      </div>
      <div {...pageAnchorAttributes("V5Page09PostBooking")}>
        <TextPanel title="Post-booking progression" text={snapshot.journey.postBookingContinuation} />
      </div>
      <div {...pageAnchorAttributes("V5Page10CommercialAccountability")}>
        <TextPanel title="Clinical-care boundary" text={snapshot.journey.clinicalBoundary} />
      </div>
      <div {...pageAnchorAttributes("V5Page11OSCapability")} style={{ display: "grid", gap: "12px" }}>
        <InlineImage image={snapshot.assets.osScreens[0] || null} ratio="58%" />
        <TextPanel
          title={snapshot.narrative.osCapability.availableTitle}
          text={<ListItems items={snapshot.narrative.osCapability.availableItems} />}
        />
        <TextPanel
          title={snapshot.narrative.osCapability.dependentTitle}
          text={<ListItems items={snapshot.narrative.osCapability.dependentItems} />}
        />
      </div>
    </Chapter>
  );
}

function MobileEconomics({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[4];
  const calculation = calculateProposalV5BreakEven(snapshot);
  const canDisplay = snapshot.readiness.breakEven.canDisplayValues && calculation.canCalculate;
  return (
    <Chapter id={section.id} pageIds={section.pageIds} eyebrow="Economics" title="Break-even only appears when the evidence is ready">
      <div {...pageAnchorAttributes("V5Page12BreakEven")}>
        <div style={{ ...styles.panel, background: colors.softPanel }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "start" }}>
            <h3 style={styles.h3}>{snapshot.economics.economicUnit || "Economic unit"}</h3>
            {statePill(calculation.state)}
          </div>
          {canDisplay ? (
            <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))" }}>
              <KeyValue label="Monthly investment" value={formatProposalV5Money(calculation.relevantMonthlyInvestmentCents)} />
              <KeyValue label="Contribution" value={formatProposalV5Money(calculation.contributionCents)} />
              <KeyValue label="Monthly break-even" value={`${calculation.recurringBreakEvenUnits} unit${calculation.recurringBreakEvenUnits === 1 ? "" : "s"}`} />
              <KeyValue label="First month" value={`${calculation.firstMonthBreakEvenUnits} unit${calculation.firstMonthBreakEvenUnits === 1 ? "" : "s"}`} />
            </div>
          ) : (
            <p style={{ ...styles.body }}>
              Commercial values stay gated until contribution, selected media spend and evidence state are confirmed.
            </p>
          )}
        </div>
      </div>
    </Chapter>
  );
}

function MobileImplementation({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[5];
  return (
    <Chapter id={section.id} pageIds={section.pageIds} eyebrow="Implementation" title={snapshot.narrative.implementation.headline}>
      <div {...pageAnchorAttributes("V5Page13Implementation")} style={{ display: "grid", gap: "12px" }}>
        <InlineImage image={snapshot.assets.implementationImage} ratio="48%" />
        {snapshot.narrative.implementation.checkpoints.map((checkpoint) => (
          <TextPanel key={checkpoint.label} title={`${checkpoint.label}: ${checkpoint.title}`} text={checkpoint.text} />
        ))}
      </div>
      <div {...pageAnchorAttributes("V5Page14OperatingRhythm")}>
        <TextPanel
          title="Operating rhythm"
          text={
            <ListItems
              items={[
                snapshot.operatingRhythm.morning,
                snapshot.operatingRhythm.weekly,
                snapshot.operatingRhythm.monthly,
                snapshot.operatingRhythm.beforeSpend,
              ]}
            />
          }
        />
      </div>
    </Chapter>
  );
}

function ScopeLine({ line }: { line: ProposalV5ScopeLine }) {
  return (
    <article style={styles.panel}>
      <div style={{ alignItems: "baseline", display: "flex", gap: "8px", justifyContent: "space-between" }}>
        <h3 style={styles.h3}>{line.title}</h3>
        <span style={{ color: colors.strongTeal, fontSize: "0.72rem", fontWeight: 800, textTransform: "uppercase" }}>
          {line.inclusionStatus || "To confirm"}
        </span>
      </div>
      <p style={{ ...styles.body, ...styles.muted, marginBottom: "12px" }}>{line.description}</p>
      <div style={{ display: "grid", gap: "8px" }}>
        <KeyValue label="Cadence / limit" value={[line.frequency, line.quantityLimit].filter(Boolean).join(" / ") || "To confirm"} />
        <KeyValue label="Responsibility" value={line.owner || "To confirm"} />
        <KeyValue label="Dependency" value={line.dependency || "To confirm"} />
        <KeyValue label="Exclusion" value={line.exclusion || "To confirm"} />
        <KeyValue label="Third-party cost" value={line.thirdPartyCosts || "To confirm"} />
      </div>
    </article>
  );
}

function MobileScope({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[6];
  return (
    <Chapter id={section.id} pageIds={section.pageIds} eyebrow="Scope" title="The selected package controls the delivery scope">
      <div {...pageAnchorAttributes("V5Page15ScopeMatrix")} style={{ display: "grid", gap: "12px" }}>
        {snapshot.scope.map((line, index) => (
          <ScopeLine key={`${line.title || "scope"}-${index}`} line={line} />
        ))}
      </div>
    </Chapter>
  );
}

function MobileResponsibilities({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[7];
  const narrative = snapshot.narrative.responsibilities;
  return (
    <Chapter id={section.id} pageIds={section.pageIds} eyebrow="Delivery" title={narrative.lede}>
      <div {...pageAnchorAttributes("V5Page16Responsibilities")} style={{ display: "grid", gap: "12px" }}>
        <TextPanel title={narrative.providerTitle} text={narrative.transitionText} />
        <TextPanel title={narrative.clientTitle} text={<ListItems items={snapshot.scope.map((line) => line.owner || "To confirm")} />} />
      </div>
    </Chapter>
  );
}

function ProofCard({ proof }: { proof: ProposalV5ProofAsset }) {
  return (
    <article data-v5-mobile-proof-pair data-v5-proof-type={proof.type || "proof"} style={styles.panel}>
      {proof.mediaUrl ? (
        <div
          aria-label={proof.title || "ClinicGrower proof asset"}
          role="img"
          style={{
            backgroundColor: colors.softPanel,
            backgroundImage: `url("${proof.mediaUrl}")`,
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "contain",
            border: `1px solid ${colors.rule}`,
            marginBottom: "12px",
            minHeight: "170px",
            width: "100%",
          }}
        />
      ) : (
        <div
          data-v5-proof-media-status="missing"
          style={{
            alignItems: "center",
            backgroundColor: colors.softPanel,
            border: `1px solid ${colors.rule}`,
            color: colors.muted,
            display: "grid",
            fontSize: "0.72rem",
            fontWeight: 800,
            justifyItems: "center",
            letterSpacing: "0.04em",
            marginBottom: "12px",
            minHeight: "92px",
            textAlign: "center",
            textTransform: "uppercase",
            width: "100%",
          }}
        >
          Evidence summary
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
        <h3 style={styles.h3}>{proof.title}</h3>
        {statePill(proof.state)}
      </div>
      <p style={{ ...styles.body }}>{proof.copy}</p>
      <p style={{ color: colors.muted, fontSize: "0.78rem", margin: "10px 0 0" }}>
        {[proof.source, proof.timeframe, proof.disclaimer].filter(Boolean).join(" · ")}
      </p>
    </article>
  );
}

function MobileProof({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[8];
  const proof = getProposalV5SelectedProofAssets(snapshot);
  return (
    <Chapter id={section.id} pageIds={section.pageIds} eyebrow="Proof" title={`Relevant proof for ${snapshot.clinic.typeShortLabel}`}>
      <div {...pageAnchorAttributes("V5Page17Proof")} style={{ display: "grid", gap: "12px" }}>
        {proof.map((asset) => (
          <ProofCard key={`${asset.title}-${asset.type}`} proof={asset} />
        ))}
      </div>
    </Chapter>
  );
}

function MobileInvestment({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[9];
  return (
    <Chapter id={section.id} pageIds={section.pageIds} dark eyebrow="Investment" title={snapshot.selectedPackage.name || "Recommended package"}>
      <div {...pageAnchorAttributes("V5Page18Investment")} style={{ display: "grid", gap: "10px" }}>
        <KeyValue label="Monthly fee" value={formatProposalV5Money(snapshot.commercial.monthlyFeeCents)} dark />
        <KeyValue label="Setup fee" value={formatProposalV5Money(snapshot.commercial.setupFeeCents)} dark />
        <KeyValue label="VAT" value={snapshot.commercial.vatStatus || "To confirm"} dark />
        <KeyValue label="Media spend" value={formatProposalV5Money(snapshot.commercial.mediaSpend.value)} dark />
        <KeyValue label="Term" value={compactMonths(snapshot.commercial.minimumTermMonths)} dark />
        <KeyValue label="Notice" value={compactDays(snapshot.commercial.noticePeriodDays)} dark />
        <KeyValue label="Start" value={compactDate(snapshot.commercial.proposedStartDate)} dark />
        <KeyValue label="Valid until" value={compactDate(snapshot.commercial.expiresAt)} dark />
      </div>
    </Chapter>
  );
}

function MobileClose({ snapshot }: ProposalV5RendererProps) {
  const section = proposalV5MobileSections[10];
  const acceptUrl = safeLink(snapshot.links.acceptUrl);
  const questionUrl = safeLink(snapshot.links.questionUrl);
  return (
    <Chapter id={section.id} pageIds={section.pageIds} dark eyebrow="Next step" title="Approve the recommendation or ask a question">
      <div {...pageAnchorAttributes("V5Page19Close")} style={{ display: "grid", gap: "12px" }}>
        <InlineImage image={snapshot.assets.sectorImages.close} ratio="44%" />
        <p style={{ color: "#DCE9E8", fontSize: "1rem", margin: 0 }}>{snapshot.narrative.implementation.decisionText}</p>
        {acceptUrl ? (
          <a href={acceptUrl} style={{ ...styles.action, background: colors.teal, color: colors.deepInk }}>
            Approve proposal
          </a>
        ) : null}
        {questionUrl ? (
          <a
            href={questionUrl}
            style={{
              ...styles.action,
              background: "transparent",
              border: `1px solid rgba(200, 223, 221, 0.44)`,
              color: colors.paper,
            }}
          >
            Ask a question
          </a>
        ) : null}
      </div>
    </Chapter>
  );
}

export function ProposalV5MobileRenderer({ snapshot }: ProposalV5RenderableRendererProps) {
  if (!isProposalV5RenderableSnapshot(snapshot)) {
    throw new Error("ProposalV5MobileRenderer requires ProposalV5Snapshot or ProposalV5PublicSnapshot. Build or sanitize the V5 snapshot before rendering.");
  }
  const renderSnapshot = snapshot as ProposalV5Snapshot;

  return (
    <article
      aria-label={`Mobile ClinicGrower V5 proposal for ${renderSnapshot.clinic.name.value || "clinic"}`}
      className="proposal-v5-mobile-renderer"
      style={styles.root}
    >
      <MobileCover snapshot={renderSnapshot} />
      <MobileEvidence snapshot={renderSnapshot} />
      <MobilePartner snapshot={renderSnapshot} />
      <MobileOperatingSystem snapshot={renderSnapshot} />
      <MobileEconomics snapshot={renderSnapshot} />
      <MobileImplementation snapshot={renderSnapshot} />
      <MobileScope snapshot={renderSnapshot} />
      <MobileResponsibilities snapshot={renderSnapshot} />
      <MobileProof snapshot={renderSnapshot} />
      <MobileInvestment snapshot={renderSnapshot} />
      <MobileClose snapshot={renderSnapshot} />
    </article>
  );
}
