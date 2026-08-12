"use client";

import { ArrowRight, CalendarClock, CheckCircle2, Loader2, MessageCircle, Printer, Send } from "lucide-react";
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
import type { ProposalPublicEventPayload, ProposalPublicPreviewRecord } from "@/lib/api-types";

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
  const [acceptanceForm, setAcceptanceForm] = useState({
    fullName: "",
    email: "",
    legalCompanyName: "",
    billingEmail: "",
    preferredStartDate: "",
    agreementAccepted: false,
    signatureConfirmation: "",
  });
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

    if (!fullName || !email || !legalCompanyName || !billingEmail || !signatureConfirmation) {
      setAcceptanceError("Please complete all required acceptance details.");
      return;
    }
    if (signatureConfirmation.toLowerCase() !== fullName.toLowerCase()) {
      setAcceptanceError("Typed confirmation must match the full name.");
      return;
    }
    if (!acceptanceForm.agreementAccepted) {
      setAcceptanceError("Please confirm agreement before accepting.");
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
      setAcceptanceForm({
        fullName: "",
        email: "",
        legalCompanyName: "",
        billingEmail: "",
        preferredStartDate: "",
        agreementAccepted: false,
        signatureConfirmation: "",
      });
    } catch (acceptError) {
      setAcceptanceError(acceptError instanceof Error ? acceptError.message : "Proposal could not be accepted.");
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

      <section id="acceptance-form" className="mx-auto max-w-5xl scroll-mt-8 rounded-[8px] border border-[#d8e4df] bg-white p-5 text-[#14231f] sm:p-6">
        {preview.acceptance ? (
          <div className="rounded-[8px] border border-[#b8d3c7] bg-[#f4faf7] p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#315f51]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#315f51]">
                  <CheckCircle2 className="h-4 w-4" />
                  Accepted and locked
                </div>
                <h2 className="mt-4 text-2xl font-semibold text-[#14231f]">Proposal accepted</h2>
                <p className="mt-2 text-sm leading-6 text-[#5b7069]">
                  This proposal has been accepted and the commercial version has been locked.
                </p>
              </div>
              <div className="text-sm text-[#5b7069]">
                <p className="font-semibold text-[#14231f]">{preview.acceptance.acceptedByName || "Accepted"}</p>
                <p>{preview.acceptance.acceptedByEmail}</p>
                <p>{preview.acceptance.legalCompanyName}</p>
                <p className="mt-2">
                  {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(preview.acceptance.acceptedAt))}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Acceptance</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">Accept this proposal</h2>
            <p className="mt-2 text-sm leading-6 text-[#5b7069]">
              Confirm the details below to accept the proposal and create the locked commercial record.
            </p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-[#354943]">
                Full name
                <input
                  value={acceptanceForm.fullName}
                  onChange={(event) => setAcceptanceForm((current) => ({ ...current, fullName: event.target.value }))}
                  className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                />
              </label>
              <label className="block text-sm font-medium text-[#354943]">
                Email
                <input
                  type="email"
                  value={acceptanceForm.email}
                  onChange={(event) => setAcceptanceForm((current) => ({ ...current, email: event.target.value }))}
                  className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                />
              </label>
              <label className="block text-sm font-medium text-[#354943]">
                Legal company name
                <input
                  value={acceptanceForm.legalCompanyName}
                  onChange={(event) => setAcceptanceForm((current) => ({ ...current, legalCompanyName: event.target.value }))}
                  className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                />
              </label>
              <label className="block text-sm font-medium text-[#354943]">
                Billing email
                <input
                  type="email"
                  value={acceptanceForm.billingEmail}
                  onChange={(event) => setAcceptanceForm((current) => ({ ...current, billingEmail: event.target.value }))}
                  className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                />
              </label>
              <label className="block text-sm font-medium text-[#354943]">
                Preferred start date
                <input
                  type="date"
                  value={acceptanceForm.preferredStartDate}
                  onChange={(event) => setAcceptanceForm((current) => ({ ...current, preferredStartDate: event.target.value }))}
                  className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                />
              </label>
              <label className="block text-sm font-medium text-[#354943]">
                Type full name to confirm
                <input
                  value={acceptanceForm.signatureConfirmation}
                  onChange={(event) => setAcceptanceForm((current) => ({ ...current, signatureConfirmation: event.target.value }))}
                  className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                />
              </label>
            </div>
            <label className="mt-5 flex items-start gap-3 rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-4 text-sm text-[#354943]">
              <input
                type="checkbox"
                checked={acceptanceForm.agreementAccepted}
                onChange={(event) => setAcceptanceForm((current) => ({ ...current, agreementAccepted: event.target.checked }))}
                className="mt-1 h-4 w-4 rounded border-[#b8c8c1] text-[#315f51]"
              />
              <span>
                I confirm I am authorised to accept this proposal and agree to the commercial terms, scope, responsibilities and next steps shown above.
              </span>
            </label>
            {acceptanceError ? (
              <p className="mt-4 rounded-[8px] border border-[#f1c7c7] bg-[#fff4f4] px-3 py-2 text-sm text-[#9f3d45]">
                {acceptanceError}
              </p>
            ) : null}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                disabled={isAccepting}
                onClick={() => {
                  trackSharedEvent("acceptance_cta_clicked", "acceptance_form");
                  void submitAcceptance();
                }}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-4 py-2 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isAccepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Accept proposal
              </button>
            </div>
          </div>
        )}
      </section>

      {!isAccepted ? (
        <div className="proposal-sticky-acceptance fixed inset-x-0 bottom-0 z-40 border-t border-[#d8e4df] bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#14231f]">Ready to move forward?</p>
              <p className="text-xs leading-5 text-[#5b7069]">
                Accept securely online or ask a question before confirming.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
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
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-4 text-sm font-semibold text-white hover:bg-[#24483d]"
              >
                Accept proposal
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
