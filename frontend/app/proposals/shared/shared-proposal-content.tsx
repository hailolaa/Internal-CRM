"use client";

import { ArrowRight, CalendarClock, CheckCircle2, FileCheck2, Loader2, LockKeyhole, MessageCircle, Printer, Send, ShieldCheck } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ProposalV5MobileRenderer,
  ProposalV5PrintRenderer,
  ProposalV5Renderer,
  isProposalV5PublicSnapshot,
  type ProposalV5PublicSnapshot,
} from "@/components/proposals/v5";
import { AlertBanner } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ProposalPublicAcceptanceSummary, ProposalPublicEventPayload, ProposalPublicPreviewRecord } from "@/lib/api-types";

export type SharedProposalRenderModel =
  | { kind: "v5"; snapshot: ProposalV5PublicSnapshot }
  | { kind: "invalid_v5"; message: string };

export function resolveSharedProposalRenderModel(preview: ProposalPublicPreviewRecord): SharedProposalRenderModel {
  const snapshot = preview.proposal.v5Snapshot;
  if (isProposalV5PublicSnapshot(snapshot)) return { kind: "v5", snapshot };

  return {
    kind: "invalid_v5",
    message: "This proposal version could not be opened.",
  };
}

export function SharedProposalV5Document({
  snapshot,
  isMobile,
}: {
  snapshot: ProposalV5PublicSnapshot;
  isMobile: boolean;
}) {
  return isMobile ? <ProposalV5MobileRenderer snapshot={snapshot} /> : <ProposalV5Renderer snapshot={snapshot} />;
}

export function SharedProposalV5PrintDocument({ snapshot }: { snapshot: ProposalV5PublicSnapshot }) {
  return (
    <div className="proposal-v5-public-print proposal-v5-print-preview" data-v5-public-print-root="true">
      <div className="proposal-v5-print-preview-surface">
        <ProposalV5PrintRenderer snapshot={snapshot} />
      </div>
    </div>
  );
}

export interface SharedProposalAcceptanceFormState {
  fullName: string;
  email: string;
  legalCompanyName: string;
  billingEmail: string;
  preferredStartDate: string;
  agreementAccepted: boolean;
  signatureConfirmation: string;
}

const emptyAcceptanceForm: SharedProposalAcceptanceFormState = {
  fullName: "",
  email: "",
  legalCompanyName: "",
  billingEmail: "",
  preferredStartDate: "",
  agreementAccepted: false,
  signatureConfirmation: "",
};

export function validateAcceptanceForm(form: SharedProposalAcceptanceFormState) {
  const fullName = form.fullName.trim();
  const email = form.email.trim();
  const legalCompanyName = form.legalCompanyName.trim();
  const billingEmail = form.billingEmail.trim();
  const signatureConfirmation = form.signatureConfirmation.trim();

  if (!fullName) return "Enter your full name to continue.";
  if (!email) return "Enter your email address to continue.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Enter a valid email address.";
  if (!legalCompanyName) return "Enter the legal company name that is accepting the proposal.";
  if (!billingEmail) return "Enter the billing email address for the accepted proposal.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(billingEmail)) return "Enter a valid billing email address.";
  if (!signatureConfirmation) return "Type your full name again to confirm the acceptance.";
  if (signatureConfirmation.toLowerCase() !== fullName.toLowerCase()) {
    return "The typed confirmation must match your full name.";
  }
  if (!form.agreementAccepted) {
    return "Tick the authority confirmation before accepting.";
  }
  return "";
}

export function getClientSafeAcceptanceError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const normalised = message.toLowerCase();

  if (normalised.includes("already") && normalised.includes("accept")) {
    return "This proposal has already been accepted. Refresh the page to view the locked confirmation.";
  }
  if (normalised.includes("expired")) {
    return "This proposal link has expired. Please ask ClinicGrower for an updated proposal.";
  }
  if (normalised.includes("invalid") || normalised.includes("snapshot") || normalised.includes("hash") || normalised.includes("corrupt")) {
    return "We could not verify this proposal version. Please ask ClinicGrower for a fresh link.";
  }
  if (normalised.includes("network") || normalised.includes("fetch") || normalised.includes("failed to")) {
    return "We could not connect right now. Please check your connection and try again.";
  }
  return "We could not complete the acceptance right now. Please try again or ask ClinicGrower for help.";
}

function formatPublicDate(value: string | null | undefined, options: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return new Intl.DateTimeFormat("en-GB", options).format(date);
}

function formatMoney(cents: number | null | undefined, currency: string | null | undefined) {
  if (typeof cents !== "number") return "Shown in proposal";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function buildAcceptanceSummary(snapshot: ProposalV5PublicSnapshot) {
  const monthlyFee = formatMoney(snapshot.selectedPackage.monthlyFeeCents, snapshot.selectedPackage.currency);
  const setupFee = formatMoney(snapshot.selectedPackage.setupFeeCents, snapshot.selectedPackage.currency);
  const minimumTerm = snapshot.selectedPackage.minimumTermMonths
    ? `${snapshot.selectedPackage.minimumTermMonths} months`
    : "Shown in proposal";
  const notice = snapshot.selectedPackage.noticePeriodDays
    ? `${snapshot.selectedPackage.noticePeriodDays} days`
    : "Shown in proposal";

  return [
    { label: "Clinic", value: snapshot.clinic.name.value || "Clinic" },
    { label: "Proposal reference", value: snapshot.proposal.reference || "Proposal" },
    { label: "Programme", value: snapshot.selectedPackage.name || "Selected ClinicGrower programme" },
    { label: "Monthly fee", value: `${monthlyFee} ${snapshot.selectedPackage.vatStatus || ""}`.trim() },
    { label: "Setup", value: setupFee },
    { label: "Minimum term", value: minimumTerm },
    { label: "Notice", value: notice },
    { label: "Valid until", value: formatPublicDate(snapshot.lifecycle.expiresAt) },
  ];
}

function AcceptanceInput({
  label,
  value,
  onChange,
  type = "text",
  autoComplete,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  help?: string;
}) {
  const fieldId = `acceptance-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  const helpId = `${fieldId}-help`;

  return (
    <label htmlFor={fieldId} className="block text-sm font-semibold text-[#173833]">
      <span>{label}</span>
      <input
        id={fieldId}
        type={type}
        value={value}
        autoComplete={autoComplete}
        aria-describedby={help ? helpId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 min-h-12 w-full rounded-[8px] border border-[#c8dfdd] bg-white px-3.5 py-2.5 text-base text-[#071f1d] outline-none transition focus:border-[#2f9e99] focus:ring-2 focus:ring-[#57bbb6]/25 sm:text-sm"
      />
      {help ? <span id={helpId} className="mt-1.5 block text-xs leading-5 text-[#5f777b]">{help}</span> : null}
    </label>
  );
}

export function PublicProposalAcceptancePanel({
  snapshot,
  acceptance,
  form,
  error,
  isAccepting,
  onChange,
  onSubmit,
}: {
  snapshot: ProposalV5PublicSnapshot;
  acceptance: ProposalPublicAcceptanceSummary | null;
  form: SharedProposalAcceptanceFormState;
  error: string;
  isAccepting: boolean;
  onChange: (form: SharedProposalAcceptanceFormState) => void;
  onSubmit: () => void;
}) {
  const summaryRows = buildAcceptanceSummary(snapshot);

  return (
    <section
      id="acceptance-form"
      aria-labelledby="proposal-acceptance-title"
      className="mx-auto max-w-5xl scroll-mt-8 overflow-hidden rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] text-[#071f1d]"
    >
      <div className="border-b border-[#c8dfdd] bg-[#071f1d] px-5 py-5 text-white sm:px-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#57bbb6]">Final client sign-off</p>
            <h2 id="proposal-acceptance-title" className="mt-2 text-2xl font-semibold tracking-[0] text-white sm:text-3xl">
              {acceptance ? "Proposal accepted" : "Accept this proposal"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#dff1ef]">
              {acceptance
                ? "This version is accepted, locked and ready for the next ClinicGrower steps."
                : "Review the sign-off details, confirm authority, then accept the exact proposal shown above."}
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-[#57bbb6]/40 bg-white/8 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-[#dff1ef]">
            <LockKeyhole className="h-4 w-4 text-[#57bbb6]" />
            Secure public proposal
          </div>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[0.92fr_1.08fr]">
        <div className="border-b border-[#c8dfdd] bg-white p-5 sm:p-7 lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#dff1ef] text-[#0c5d58]">
              <FileCheck2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#2f7f79]">What you are accepting</p>
              <p className="text-sm text-[#5f777b]">The locked proposal reviewed on this page.</p>
            </div>
          </div>

          <dl className="mt-5 divide-y divide-[#d8e9e7] rounded-[8px] border border-[#d8e9e7] bg-[#fbfdfc]">
            {summaryRows.map((row) => (
              <div key={row.label} className="grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-4">
                <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5f777b]">{row.label}</dt>
                <dd className="text-sm font-semibold leading-5 text-[#132e35]">{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 rounded-[8px] border border-[#c8dfdd] bg-[#dff1ef] p-4">
            <div className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[#2f9e99]" />
              <p className="text-sm leading-6 text-[#173833]">
                Once accepted, the commercial version is locked. ClinicGrower will use this accepted scope, investment and terms to start the next steps.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#f9fcfb] p-5 sm:p-7">
          {acceptance ? (
            <div className="rounded-[8px] border border-[#b8d3c7] bg-white p-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#315f51]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#315f51]">
                <CheckCircle2 className="h-4 w-4" />
                Accepted and locked
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-[#14231f]">Acceptance complete</h3>
              <p className="mt-2 text-sm leading-6 text-[#5b7069]">
                Thank you. The accepted proposal is locked and the ClinicGrower team will follow up with the next onboarding steps.
              </p>
              <dl className="mt-5 grid gap-3 rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-4 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5f777b]">Accepted by</dt>
                  <dd className="mt-1 font-semibold text-[#14231f]">{acceptance.acceptedByName || "Accepted"}</dd>
                  <dd className="text-[#5b7069]">{acceptance.acceptedByEmail}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5f777b]">Legal company</dt>
                  <dd className="mt-1 font-semibold text-[#14231f]">{acceptance.legalCompanyName}</dd>
                  {acceptance.billingEmail ? <dd className="text-[#5b7069]">Billing: {acceptance.billingEmail}</dd> : null}
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5f777b]">Accepted on</dt>
                  <dd className="mt-1 font-semibold text-[#14231f]">
                    {formatPublicDate(acceptance.acceptedAt, { dateStyle: "medium", timeStyle: "short" })}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-xs leading-5 text-[#5f777b]" role="status">
                No further acceptance action is needed on this page.
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#2f7f79]">Confirm acceptance</p>
              <h3 className="mt-2 text-xl font-semibold text-[#132e35]">Complete the sign-off details</h3>
              <p className="mt-2 text-sm leading-6 text-[#5f777b]">
                These details confirm who accepted the proposal and where billing communication should go.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <AcceptanceInput
                  label="Full name"
                  value={form.fullName}
                  autoComplete="name"
                  onChange={(fullName) => onChange({ ...form, fullName })}
                  help="Use the authorised signatory's name."
                />
                <AcceptanceInput
                  label="Email"
                  type="email"
                  value={form.email}
                  autoComplete="email"
                  onChange={(email) => onChange({ ...form, email })}
                />
                <AcceptanceInput
                  label="Legal company name"
                  value={form.legalCompanyName}
                  autoComplete="organization"
                  onChange={(legalCompanyName) => onChange({ ...form, legalCompanyName })}
                />
                <AcceptanceInput
                  label="Billing email"
                  type="email"
                  value={form.billingEmail}
                  autoComplete="email"
                  onChange={(billingEmail) => onChange({ ...form, billingEmail })}
                />
                <AcceptanceInput
                  label="Preferred start date"
                  type="date"
                  value={form.preferredStartDate}
                  onChange={(preferredStartDate) => onChange({ ...form, preferredStartDate })}
                  help="Optional. ClinicGrower will confirm scheduling after acceptance."
                />
                <AcceptanceInput
                  label="Type full name to confirm"
                  value={form.signatureConfirmation}
                  autoComplete="off"
                  onChange={(signatureConfirmation) => onChange({ ...form, signatureConfirmation })}
                />
              </div>

              <label className="mt-5 flex items-start gap-3 rounded-[8px] border border-[#c8dfdd] bg-white p-4 text-sm text-[#354943]">
                <input
                  type="checkbox"
                  checked={form.agreementAccepted}
                  onChange={(event) => onChange({ ...form, agreementAccepted: event.target.checked })}
                  className="mt-1 h-5 w-5 rounded border-[#b8c8c1] text-[#315f51]"
                />
                <span>
                  I confirm I am authorised to accept this proposal and agree to the commercial terms, scope, responsibilities and next steps shown above.
                </span>
              </label>

              {error ? (
                <p id="acceptance-error" className="mt-4 rounded-[8px] border border-[#e7b7b7] bg-[#fff6f4] px-4 py-3 text-sm leading-6 text-[#8d2d35]" role="alert">
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                disabled={isAccepting}
                aria-describedby={error ? "acceptance-error" : undefined}
                onClick={onSubmit}
                className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-[8px] bg-[#071f1d] px-5 py-3 text-base font-semibold text-white transition hover:bg-[#132e35] disabled:cursor-not-allowed disabled:opacity-70 sm:w-auto sm:text-sm"
              >
                {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {isAccepting ? "Accepting securely..." : "Accept and lock proposal"}
              </button>
              <p className="mt-3 text-xs leading-5 text-[#5f777b]" aria-live="polite">
                The button remains available so you can see any missing information clearly before the proposal is accepted.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function usePublicV5MobileViewport() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const updateViewport = () => setIsMobile(mediaQuery.matches);

    updateViewport();
    mediaQuery.addEventListener("change", updateViewport);
    return () => mediaQuery.removeEventListener("change", updateViewport);
  }, []);

  return isMobile;
}

export function SharedProposalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const isPublicV5Mobile = usePublicV5MobileViewport();
  const [preview, setPreview] = useState<ProposalPublicPreviewRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [error, setError] = useState("");
  const [acceptanceError, setAcceptanceError] = useState("");
  const [acceptanceForm, setAcceptanceForm] = useState<SharedProposalAcceptanceFormState>(emptyAcceptanceForm);
  const trackedEventsRef = useRef<Set<string>>(new Set());

  const loadSharedProposal = useCallback(async () => {
    if (!token) {
      setPreview(null);
      setError("This proposal link is invalid.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const data = await api.proposals.getShared(token);
      setPreview(data);
    } catch (loadError) {
      setPreview(null);
      setError(loadError instanceof Error ? loadError.message : "This proposal link could not be opened.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSharedProposal();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadSharedProposal]);

  const trackSharedEvent = useCallback((eventType: ProposalPublicEventPayload["eventType"], sectionKey?: string | null) => {
    if (!token || !preview) return;
    const dedupeKey = `${eventType}:${sectionKey || ""}`;
    if (eventType === "section_viewed" && trackedEventsRef.current.has(dedupeKey)) return;
    trackedEventsRef.current.add(dedupeKey);
    void api.proposals.trackShared(token, { eventType, sectionKey: sectionKey || null }).catch(() => undefined);
  }, [preview, token]);

  useEffect(() => {
    if (!preview || typeof IntersectionObserver === "undefined") return;
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".proposal-client-document > header, .proposal-client-document > section, .proposal-client-document > footer, .proposal-v5-renderer [data-v5-page-id], .proposal-v5-mobile-renderer [data-v5-page-id]",
      ),
    );
    if (!sections.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const section = entry.target as HTMLElement;
        const sectionKey = section.id || section.dataset.proposalSection || `section_${sections.indexOf(section) + 1}`;
        trackSharedEvent("section_viewed", sectionKey);
      });
    }, { threshold: 0.45 });

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [isPublicV5Mobile, preview, trackSharedEvent]);

  useEffect(() => {
    if (!preview) return;
    const videoFrame = document.querySelector<HTMLElement>(".proposal-video-frame");
    if (!videoFrame) return;
    const handleVideoInteraction = () => trackSharedEvent("video_opened", "proposal_video");
    videoFrame.addEventListener("pointerdown", handleVideoInteraction, { once: true });
    return () => videoFrame.removeEventListener("pointerdown", handleVideoInteraction);
  }, [preview, trackSharedEvent]);

  const submitAcceptance = useCallback(async () => {
    setAcceptanceError("");
    if (!token || !preview || isAccepting) return;
    const fullName = acceptanceForm.fullName.trim();
    const email = acceptanceForm.email.trim();
    const legalCompanyName = acceptanceForm.legalCompanyName.trim();
    const billingEmail = acceptanceForm.billingEmail.trim();
    const signatureConfirmation = acceptanceForm.signatureConfirmation.trim();

    const validationError = validateAcceptanceForm(acceptanceForm);
    if (validationError) {
      setAcceptanceError(validationError);
      return;
    }

    setIsAccepting(true);
    try {
      const acceptedPreview = await api.proposals.acceptShared(token, {
        fullName,
        email,
        legalCompanyName,
        billingEmail,
        preferredStartDate: acceptanceForm.preferredStartDate || null,
        agreementAccepted: true,
        signatureConfirmation,
      });
      setPreview(acceptedPreview);
      setAcceptanceForm(emptyAcceptanceForm);
    } catch (acceptError) {
      setAcceptanceError(getClientSafeAcceptanceError(acceptError));
    } finally {
      setIsAccepting(false);
    }
  }, [acceptanceForm, isAccepting, preview, token]);

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[520px] max-w-5xl items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
        <span className="sr-only">Loading proposal</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <AlertBanner title="Proposal unavailable" description={error} variant="error" />
      </div>
    );
  }

  if (!preview) return null;

  const isAccepted = Boolean(preview.acceptance);
  const proposalQuestionSubject = encodeURIComponent(
    `Question about ${preview.proposal.proposalName || "ClinicGrower proposal"}`,
  );
  const proposalQuestionHref = `mailto:hello@clinicgrower.co.uk?subject=${proposalQuestionSubject}`;
  const renderModel = resolveSharedProposalRenderModel(preview);
  const printProposal = () => {
    trackSharedEvent("pdf_download_clicked", "proposal_pdf");
    if (renderModel.kind === "v5") {
      const previousTitle = document.title;
      document.title = `ClinicGrower V5 Proposal - ${renderModel.snapshot.clinic.name.value || "Proposal"}`;
      window.print();
      window.setTimeout(() => {
        document.title = previousTitle;
      }, 250);
      return;
    }
  };

  if (renderModel.kind === "invalid_v5") {
    return (
      <div className="mx-auto max-w-3xl">
        <AlertBanner title="Proposal unavailable" description={renderModel.message} variant="error" />
      </div>
    );
  }

  return (
    <div className="proposal-shared-public-shell space-y-6 pb-24">
      <SharedProposalV5Document snapshot={renderModel.snapshot} isMobile={isPublicV5Mobile} />
      <SharedProposalV5PrintDocument snapshot={renderModel.snapshot} />

      <PublicProposalAcceptancePanel
        snapshot={renderModel.snapshot}
        acceptance={preview.acceptance}
        form={acceptanceForm}
        error={acceptanceError}
        isAccepting={isAccepting}
        onChange={setAcceptanceForm}
        onSubmit={() => {
          trackSharedEvent("acceptance_cta_clicked", "acceptance_form");
          void submitAcceptance();
        }}
      />

      {!isAccepted ? (
        <div className="proposal-sticky-acceptance fixed inset-x-0 bottom-0 z-40 border-t border-[#c8dfdd] bg-white/95 px-4 py-3 shadow-[0_-1px_0_rgba(1,20,24,0.04)] backdrop-blur sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#14231f]">Ready for final sign-off?</p>
              <p className="text-xs leading-5 text-[#5b7069]">
                Accept the locked proposal securely online, or ask a question first.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <a
                href={proposalQuestionHref}
                onClick={() => trackSharedEvent("question_clicked", "sticky_cta")}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-4 text-sm font-semibold text-[#315f51] hover:border-[#315f51]"
              >
                <MessageCircle className="h-4 w-4" />
                Ask a question
              </a>
              <a
                href="https://clinicgrower.co.uk/contact/"
                target="_blank"
                rel="noreferrer"
                onClick={() => trackSharedEvent("book_call_clicked", "sticky_cta")}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-4 text-sm font-semibold text-[#315f51] hover:border-[#315f51]"
              >
                <CalendarClock className="h-4 w-4" />
                Book a call
              </a>
              <button
                type="button"
                onClick={printProposal}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-4 text-sm font-semibold text-[#315f51] hover:border-[#315f51]"
              >
                <Printer className="h-4 w-4" />
                Download PDF
              </button>
              <a
                href="#acceptance-form"
                onClick={() => trackSharedEvent("acceptance_cta_clicked", "sticky_cta")}
                className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-[8px] bg-[#071f1d] px-4 text-sm font-semibold text-white hover:bg-[#132e35] sm:flex-none"
              >
                Accept and lock
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
