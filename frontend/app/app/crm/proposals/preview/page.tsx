"use client";

import { ArrowLeft, CheckCircle2, Clock, Copy, ExternalLink, Link2, Loader2, Printer, RefreshCw, Send, Trophy, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertBanner, PageHeader } from "@/components/ui";
import { SubNav } from "@/components/sub-nav";
import { SALES_NAV } from "@/lib/section-nav";
import { api } from "@/lib/api-client";
import type { GrowthPackageRecord, ProposalRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { ClinicGrowerProposalTemplate } from "@/components/proposals/clinicgrower-proposal-template";

const sampleProposal: ProposalRecord = {
  id: "preview",
  contactId: null,
  dealId: null,
  clientAccountProfileId: null,
  proposalName: "Growth Engine Proposal",
  templateKey: "clinicgrower_standard",
  packageName: "Growth Engine",
  recommendedPackageId: null,
  ownerId: null,
  ownerName: "ClinicGrower Sales",
  status: "draft",
  valueCents: 199500,
  monthlyFeeCents: 199500,
  setupFeeCents: null,
  currency: "GBP",
  adSpendNote: "Ad spend is managed separately and agreed before campaign launch.",
  vatStatus: "plus_vat",
  minimumTermMonths: 6,
  noticePeriodDays: 30,
  startDate: null,
  followUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  readyAt: null,
  sentAt: null,
  sentToEmail: null,
  sentToName: null,
  sendMethod: null,
  sendNote: null,
  sentBy: null,
  sentByName: null,
  viewedAt: null,
  acceptedAt: null,
  acceptedReason: null,
  wonAt: null,
  wonReason: null,
  lostAt: null,
  lostReason: null,
  expiresAt: null,
  proposalUrl: null,
  notes: "Internal preview generated from Mission Control.",
  addOns: [],
  discounts: [],
  internalMarginNote: null,
  sectionContent: null,
  draftSavedAt: null,
  contactName: "Practice Owner",
  contactEmail: "owner@exampleclinic.co.uk",
  accountName: "Example Growth Clinic",
  dealTitle: "Example Growth Clinic - Growth Engine",
  clientAccountName: null,
  createdBy: null,
  updatedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const samplePackage: GrowthPackageRecord = {
  id: "growth-engine-preview",
  name: "Growth Engine",
  priceCents: 199500,
  currency: "GBP",
  billingFrequency: "monthly",
  setupFeeCents: null,
  includedFeatures: [
    "Clinic Growth Score and commercial opportunity map",
    "Website conversion plan and landing page direction",
    "SEO, GBP and paid acquisition priorities",
    "Tracking, reporting and lead-source visibility",
    "Lead handling and follow-up recommendations",
    "Monthly action plan and performance review rhythm",
  ],
  internalNotes: null,
  proposalWording:
    "Growth Engine is designed for clinics ready to scale acquisition with a controlled website, SEO, ads, tracking and lead handling operating system.",
  sortOrder: 50,
  status: "active",
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function findMatchingPackage(proposal: ProposalRecord, packages: GrowthPackageRecord[]) {
  if (proposal.recommendedPackageId) {
    const selected = packages.find((item) => item.id === proposal.recommendedPackageId);
    if (selected) return selected;
  }
  const target = (proposal.packageName || proposal.proposalName || "").toLowerCase();
  return packages.find((item) => target.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(target)) || null;
}

function toDatetimeLocalValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const acceptedReasons = ["Verbal acceptance", "Email acceptance", "Accepted pending setup", "Other"];
const wonReasons = ["Accepted recommended package", "Budget approved", "Urgent growth priority", "Existing relationship", "Other"];
const lostReasons = ["Price/budget", "No response", "Timing", "Chose competitor", "Not a fit", "Other"];

export default function ProposalPreviewPage() {
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("id") || "";
  const { session } = useAuth();
  const token = session?.token;
  const [proposal, setProposal] = useState<ProposalRecord | null>(proposalId ? null : sampleProposal);
  const [packages, setPackages] = useState<GrowthPackageRecord[]>(proposalId ? [] : [samplePackage]);
  const [isLoading, setIsLoading] = useState(Boolean(proposalId));
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
  const [isMarkingSent, setIsMarkingSent] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [sendRecipientEmail, setSendRecipientEmail] = useState("");
  const [sendRecipientName, setSendRecipientName] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [followUpAt, setFollowUpAt] = useState("");
  const [acceptedReason, setAcceptedReason] = useState(acceptedReasons[0]);
  const [wonReason, setWonReason] = useState(wonReasons[0]);
  const [lostReason, setLostReason] = useState(lostReasons[0]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadPreview = useCallback(async () => {
    if (!token || !proposalId) {
      setProposal(sampleProposal);
      setPackages([samplePackage]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const [proposalRecord, packageRecords] = await Promise.all([
        api.proposals.get(token, proposalId),
        api.packages.list(token, { includeInactive: true }),
      ]);
      setProposal(proposalRecord);
      setPackages(packageRecords);
      setSendRecipientEmail(proposalRecord.sentToEmail || proposalRecord.contactEmail || "");
      setSendRecipientName(proposalRecord.sentToName || proposalRecord.contactName || proposalRecord.accountName || "");
      setSendNote(proposalRecord.sendNote || "");
      setFollowUpAt(toDatetimeLocalValue(proposalRecord.followUpAt));
      setAcceptedReason(proposalRecord.acceptedReason || acceptedReasons[0]);
      setWonReason(proposalRecord.wonReason || wonReasons[0]);
      setLostReason(proposalRecord.lostReason || lostReasons[0]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load proposal preview.");
      setProposal(null);
    } finally {
      setIsLoading(false);
    }
  }, [proposalId, token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const packageRecord = useMemo(
    () => (proposal ? findMatchingPackage(proposal, packages) || (proposalId ? null : samplePackage) : null),
    [packages, proposal, proposalId],
  );

  const createProposalLink = useCallback(async () => {
    if (!token || !proposalId) return;
    setIsGeneratingLink(true);
    setError("");
    setMessage("");
    try {
      const share = await api.proposals.share(token, proposalId);
      setProposal((current) => current ? { ...current, proposalUrl: share.proposalUrl } : current);
      setMessage("Unique proposal link generated and saved to this proposal record.");
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(share.proposalUrl);
        setMessage("Unique proposal link generated, saved and copied.");
      }
    } catch (shareError) {
      setError(shareError instanceof Error ? shareError.message : "Could not generate proposal link.");
    } finally {
      setIsGeneratingLink(false);
    }
  }, [proposalId, token]);

  const markProposalSent = useCallback(async () => {
    if (!token || !proposalId) return;
    setIsMarkingSent(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.proposals.send(token, proposalId, {
        recipientEmail: sendRecipientEmail.trim() || null,
        recipientName: sendRecipientName.trim() || null,
        sendMethod: "manual_email",
        sendNote: sendNote.trim() || null,
      });
      setProposal(updated);
      setSendRecipientEmail(updated.sentToEmail || updated.contactEmail || "");
      setSendRecipientName(updated.sentToName || updated.contactName || updated.accountName || "");
      setSendNote(updated.sendNote || "");
      setMessage("Proposal sent date, recipient and manual send log saved.");
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Could not mark proposal as sent.");
    } finally {
      setIsMarkingSent(false);
    }
  }, [proposalId, sendNote, sendRecipientEmail, sendRecipientName, token]);

  const updateProposalStatus = useCallback(async (
    status: "follow_up_due" | "accepted" | "won" | "lost",
    reason?: string,
  ) => {
    if (!token || !proposalId) return;
    setIsUpdatingStatus(true);
    setError("");
    setMessage("");
    try {
      const updated = await api.proposals.updateStatus(token, proposalId, {
        status,
        followUpAt: status === "follow_up_due" ? followUpAt || null : undefined,
        reason: status === "follow_up_due" ? undefined : reason || null,
      });
      setProposal(updated);
      setFollowUpAt(toDatetimeLocalValue(updated.followUpAt));
      setAcceptedReason(updated.acceptedReason || acceptedReasons[0]);
      setWonReason(updated.wonReason || wonReasons[0]);
      setLostReason(updated.lostReason || lostReasons[0]);
      setMessage(
        status === "follow_up_due"
          ? "Proposal follow-up saved and linked to internal tasks/dashboard."
          : `Proposal marked ${statusLabel(status)} and linked opportunity updated.`,
      );
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "Could not update proposal status.");
    } finally {
      setIsUpdatingStatus(false);
    }
  }, [followUpAt, proposalId, token]);

  return (
    <div className="min-h-screen bg-[#f5f6f1]">
      <PageHeader
        title="Proposal Preview"
        subtitle="Preview the internal ClinicGrower proposal template without Better Proposals."
        right={
          <div className="flex flex-wrap gap-2">
            <Link
              href={proposalId ? `/app/crm/proposals/edit?id=${encodeURIComponent(proposalId)}` : "/app/crm/proposals/edit"}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Edit
            </Link>
            <button
              type="button"
              onClick={() => void loadPreview()}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            {proposalId ? (
              <button
                type="button"
                disabled={isGeneratingLink || isLoading}
                onClick={() => void createProposalLink()}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isGeneratingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Generate link
              </button>
            ) : null}
            {proposalId ? (
              <button
                type="button"
                disabled={isMarkingSent || isLoading}
                onClick={() => void markProposalSent()}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isMarkingSent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Mark sent
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d]"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        }
      />
      <SubNav items={SALES_NAV} />

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        {!proposalId && (
          <div className="mx-auto mb-4 max-w-5xl">
            <AlertBanner
              title="Preview sample"
              description="Add a proposal id in the URL to preview a real CRM proposal. The reusable template is ready for the proposal builder and send flow."
              variant="info"
            />
          </div>
        )}

        {error && (
          <div className="mx-auto mb-4 max-w-5xl">
            <AlertBanner title="Proposal could not be loaded" description={error} variant="error" />
          </div>
        )}

        {message && (
          <div className="mx-auto mb-4 max-w-5xl">
            <AlertBanner title="Proposal updated" description={message} variant="success" />
          </div>
        )}

        {isLoading ? (
          <div className="mx-auto flex min-h-[420px] max-w-5xl items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
          </div>
        ) : proposal ? (
          <>
            {proposalId ? (
              <section className="mx-auto mb-4 max-w-5xl rounded-[8px] border border-[#d8e4df] bg-white p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto] lg:items-end">
                  <label className="block text-sm font-medium text-[#354943]">
                    Recipient email
                    <input
                      type="email"
                      value={sendRecipientEmail}
                      onChange={(event) => setSendRecipientEmail(event.target.value)}
                      className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#354943]">
                    Recipient name
                    <input
                      value={sendRecipientName}
                      onChange={(event) => setSendRecipientName(event.target.value)}
                      className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                    />
                  </label>
                  <label className="block text-sm font-medium text-[#354943]">
                    Send note
                    <input
                      value={sendNote}
                      onChange={(event) => setSendNote(event.target.value)}
                      placeholder="Manual email sent from Gmail"
                      className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={isMarkingSent}
                    onClick={() => void markProposalSent()}
                    className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isMarkingSent ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Log sent
                  </button>
                </div>
                {proposal.sentAt ? (
                  <p className="mt-3 text-sm text-[#5b7069]">
                    Sent {new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(proposal.sentAt))}
                    {proposal.sentToEmail ? ` to ${proposal.sentToEmail}` : ""}
                    {proposal.sentByName ? ` by ${proposal.sentByName}` : ""}.
                  </p>
                ) : null}
              </section>
            ) : null}
            {proposalId ? (
              <section className="mx-auto mb-4 max-w-5xl rounded-[8px] border border-[#d8e4df] bg-white p-4">
                <div className="grid gap-4 xl:grid-cols-[1fr_1fr_1fr]">
                  <div className="rounded-[8px] border border-[#e3ece8] bg-[#f8fbf9] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#14231f]">Follow-up</p>
                        <p className="text-xs text-[#5b7069]">Creates or updates the proposal follow-up task.</p>
                      </div>
                      <Clock className="h-4 w-4 text-[#315f51]" />
                    </div>
                    <label className="block text-sm font-medium text-[#354943]">
                      Due date and time
                      <input
                        type="datetime-local"
                        value={followUpAt}
                        onChange={(event) => setFollowUpAt(event.target.value)}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>
                    <button
                      type="button"
                      disabled={isUpdatingStatus || !followUpAt}
                      onClick={() => void updateProposalStatus("follow_up_due")}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isUpdatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
                      Save follow-up
                    </button>
                  </div>

                  <div className="rounded-[8px] border border-[#e3ece8] bg-[#f8fbf9] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#14231f]">Accepted / won</p>
                        <p className="text-xs text-[#5b7069]">Moves the linked opportunity to Won.</p>
                      </div>
                      <Trophy className="h-4 w-4 text-[#315f51]" />
                    </div>
                    <label className="block text-sm font-medium text-[#354943]">
                      Acceptance reason
                      <select
                        value={acceptedReason}
                        onChange={(event) => setAcceptedReason(event.target.value)}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      >
                        {acceptedReasons.map((reason) => <option key={reason}>{reason}</option>)}
                      </select>
                    </label>
                    <label className="mt-3 block text-sm font-medium text-[#354943]">
                      Won reason
                      <select
                        value={wonReason}
                        onChange={(event) => setWonReason(event.target.value)}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      >
                        {wonReasons.map((reason) => <option key={reason}>{reason}</option>)}
                      </select>
                    </label>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => void updateProposalStatus("accepted", acceptedReason)}
                        className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#b8d3c7] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Accepted
                      </button>
                      <button
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => void updateProposalStatus("won", wonReason)}
                        className="inline-flex items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Trophy className="h-4 w-4" />
                        Won
                      </button>
                    </div>
                  </div>

                  <div className="rounded-[8px] border border-[#e3ece8] bg-[#f8fbf9] p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#14231f]">Lost</p>
                        <p className="text-xs text-[#5b7069]">Stores the reason and moves the linked opportunity to Lost.</p>
                      </div>
                      <XCircle className="h-4 w-4 text-[#9f3d45]" />
                    </div>
                    <label className="block text-sm font-medium text-[#354943]">
                      Lost reason
                      <select
                        value={lostReason}
                        onChange={(event) => setLostReason(event.target.value)}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      >
                        {lostReasons.map((reason) => <option key={reason}>{reason}</option>)}
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => void updateProposalStatus("lost", lostReason)}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-[8px] border border-[#e7c4c8] bg-white px-3 py-2 text-sm font-semibold text-[#9f3d45] hover:border-[#d89097] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <XCircle className="h-4 w-4" />
                      Mark lost
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-xs text-[#5b7069]">
                  Current status: <span className="font-semibold text-[#14231f]">{statusLabel(proposal.status)}</span>
                  {proposal.followUpAt ? ` - follow-up ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(proposal.followUpAt))}` : ""}
                </p>
              </section>
            ) : null}
            <div className="mx-auto mb-4 flex max-w-5xl justify-end">
              {proposal.proposalUrl ? (
                <div className="flex flex-wrap items-center justify-end gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2">
                  <span className="max-w-[min(560px,80vw)] truncate text-sm text-[#4e635d]">{proposal.proposalUrl}</span>
                  <button
                    type="button"
                    onClick={() => void navigator.clipboard?.writeText(proposal.proposalUrl || "")}
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#315f51] hover:text-[#24483d]"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                  <a
                    href={proposal.proposalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-semibold text-[#315f51] hover:text-[#24483d]"
                  >
                    Open
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              ) : null}
            </div>
            <ClinicGrowerProposalTemplate proposal={proposal} packageRecord={packageRecord} />
          </>
        ) : null}
      </main>
    </div>
  );
}
