"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProposalV5PrintRenderer, isProposalV5Snapshot, type ProposalV5Snapshot } from "@/components/proposals/v5";
import {
  buildProposalV5PreviewSnapshot,
  listProposalV5PreviewClinicTypes,
  proposalV5PreviewPackages,
} from "@/components/proposals/v5/data/previewSnapshot";
import { getProposalV5ClinicTypeVariant, normaliseProposalV5ClinicTypeId } from "@/components/proposals/v5/data/clinicTypeVariants";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const previewRoute = "/app/crm/proposals/v5-print-preview";

function optionHref(clinicType: string, packageId: string, longContent: boolean, extremeContent: boolean) {
  const params = new URLSearchParams();
  params.set("clinicType", clinicType);
  params.set("package", packageId);
  if (longContent || extremeContent) params.set("case", extremeContent ? "extreme" : "long");
  return `${previewRoute}?${params.toString()}`;
}

function cloneWithExtremeClinicName(snapshot: ProposalV5Snapshot): ProposalV5Snapshot {
  return {
    ...snapshot,
    clinic: {
      ...snapshot.clinic,
      name: {
        ...snapshot.clinic.name,
        value:
          "ClinicGrower OS Commercial Accountability Proposal for The Very Long Multi Location Private Dental Aesthetic Surgical Medical Spa Group",
      },
      location: {
        ...snapshot.clinic.location,
        value: "Bristol, Bath, Cardiff, Cheltenham and extended surrounding private patient catchment area",
      },
    },
    recipient: {
      ...snapshot.recipient,
      name: {
        ...snapshot.recipient.name,
        value: "Dr Alexandra Victoria Montgomery-Singh, Managing Partner and Authorised Decision Maker",
      },
    },
  };
}

export function ProposalV5PrivatePrintPreviewView({
  clinicTypeInput,
  packageIdInput,
  longContent,
  extremeContent,
  persistedSnapshot,
  persistedProposalName,
}: {
  clinicTypeInput?: string | null;
  packageIdInput?: string | null;
  longContent?: boolean;
  extremeContent?: boolean;
  persistedSnapshot?: ProposalV5Snapshot | null;
  persistedProposalName?: string | null;
}) {
  const clinicType = normaliseProposalV5ClinicTypeId(clinicTypeInput);
  const packageId = packageIdInput || "clinic-growth-engine";
  const fixtureSnapshot = useMemo(() => {
    const snapshot = buildProposalV5PreviewSnapshot({
      clinicType,
      packageId,
      longContent: Boolean(longContent || extremeContent),
    });
    return extremeContent ? cloneWithExtremeClinicName(snapshot) : snapshot;
  }, [clinicType, packageId, longContent, extremeContent]);
  const snapshot = persistedSnapshot || fixtureSnapshot;
  const clinicTypes = listProposalV5PreviewClinicTypes();
  const selectedClinicVariant = getProposalV5ClinicTypeVariant(snapshot.clinic.clinicType);
  const isPersistedPreview = Boolean(persistedSnapshot);
  const activePackageId = snapshot.selectedPackage.id || packageId;

  const printProposal = () => {
    const previousTitle = document.title;
    document.title = `ClinicGrower V5 Proposal - ${snapshot.clinic.name.value || "Print Preview"}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 250);
  };

  return (
    <div className="proposal-v5-print-preview">
      <section
        aria-label="Private V5 print preview controls"
        className="proposal-v5-print-preview-chrome mb-6 rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-[#132e35]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f9e99]">Private internal print preview</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#011418]">ClinicGrower V5 print/PDF renderer</h1>
            <p className="mt-2 text-sm leading-6 text-[#5f777b]">
              {isPersistedPreview
                ? `Rendering the frozen V5 snapshot stored on ${persistedProposalName || "this proposal"}. This route does not rebuild sent proposals from mutable editor or package data.`
                : "This route renders the isolated print renderer through the real Next app for internal PDF acceptance. It is not connected to public proposal links, the editor or customer navigation."}
            </p>
          </div>
          <div className="grid gap-2 text-sm text-[#132e35] lg:min-w-[260px]">
            <div className="rounded-[6px] border border-[#c8dfdd] bg-white p-3">
              <span className="block text-[11px] font-semibold uppercase text-[#5f777b]">Clinic type</span>
              <span className="mt-1 block font-semibold">{selectedClinicVariant.label}</span>
            </div>
            <div className="rounded-[6px] border border-[#c8dfdd] bg-white p-3">
              <span className="block text-[11px] font-semibold uppercase text-[#5f777b]">Package</span>
              <span className="mt-1 block font-semibold">{snapshot.selectedPackage.name}</span>
            </div>
            <button
              type="button"
              onClick={printProposal}
              className="rounded-[6px] border border-[#011418] bg-[#011418] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0c2a30]"
            >
              Print / save PDF
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_1fr]">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f777b]">Clinic variants</p>
            <div className="flex flex-wrap gap-2">
              {clinicTypes.map((item) => {
                const variant = getProposalV5ClinicTypeVariant(item);
                const selected = item === snapshot.clinic.clinicType;
                return (
                  <Link
                    key={item}
                    href={optionHref(item, activePackageId, Boolean(longContent), Boolean(extremeContent))}
                    className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
                      selected
                        ? "border-[#2f9e99] bg-[#2f9e99] text-white"
                        : "border-[#c8dfdd] bg-white text-[#132e35] hover:border-[#2f9e99]"
                    }`}
                  >
                    {variant.shortLabel}
                  </Link>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#5f777b]">Packages</p>
            <div className="flex flex-wrap gap-2">
              {proposalV5PreviewPackages.map((item) => {
                const selected = item.id === snapshot.selectedPackage.id;
                return (
                  <Link
                    key={item.id}
                    href={optionHref(clinicType, item.id, Boolean(longContent), Boolean(extremeContent))}
                    className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
                      selected
                        ? "border-[#011418] bg-[#011418] text-white"
                        : "border-[#c8dfdd] bg-white text-[#132e35] hover:border-[#2f9e99]"
                    }`}
                  >
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={optionHref(clinicType, activePackageId, false, false)}
            className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
              !longContent && !extremeContent ? "border-[#57bbb6] bg-[#dff1ef] text-[#011418]" : "border-[#c8dfdd] bg-white text-[#132e35]"
            }`}
          >
            Normal
          </Link>
          <Link
            href={optionHref(clinicType, activePackageId, true, false)}
            className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
              longContent && !extremeContent ? "border-[#57bbb6] bg-[#dff1ef] text-[#011418]" : "border-[#c8dfdd] bg-white text-[#132e35]"
            }`}
          >
            Long content
          </Link>
          <Link
            href={optionHref(clinicType, activePackageId, true, true)}
            className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
              extremeContent ? "border-[#57bbb6] bg-[#dff1ef] text-[#011418]" : "border-[#c8dfdd] bg-white text-[#132e35]"
            }`}
          >
            Extreme cover
          </Link>
          <Link
            href={`/app/crm/proposals/v5-mobile-preview?clinicType=${encodeURIComponent(clinicType)}&package=${encodeURIComponent(activePackageId)}${longContent ? "&case=long" : ""}`}
            className="rounded-[6px] border border-[#c8dfdd] bg-white px-3 py-2 text-xs font-semibold text-[#132e35] hover:border-[#2f9e99]"
          >
            Open mobile V5 preview
          </Link>
        </div>
      </section>

      <div className="proposal-v5-print-preview-surface overflow-x-auto pb-8">
        <ProposalV5PrintRenderer snapshot={snapshot} />
      </div>
    </div>
  );
}

function ProposalV5PersistedSnapshotPrintPreview({
  proposalId,
  token,
}: {
  proposalId: string;
  token: string;
}) {
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    snapshot: ProposalV5Snapshot | null;
    proposalName: string | null;
    message: string;
  }>({
    status: "loading",
    snapshot: null,
    proposalName: null,
    message: "",
  });

  useEffect(() => {
    let cancelled = false;
    api.proposals.get(token, proposalId)
      .then((proposal) => {
        if (cancelled) return;
        if (!isProposalV5Snapshot(proposal.v5Snapshot)) {
          setState({
            status: "error",
            snapshot: null,
            proposalName: proposal.proposalName,
            message: "This proposal does not have a frozen V5 snapshot. Send the proposal from the V5 workflow before opening the print/PDF preview.",
          });
          return;
        }
        setState({
          status: "ready",
          snapshot: proposal.v5Snapshot,
          proposalName: proposal.proposalName,
          message: "",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          status: "error",
          snapshot: null,
          proposalName: null,
          message: error instanceof Error ? error.message : "Could not load the frozen V5 proposal snapshot.",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [proposalId, token]);

  if (state.status === "loading") {
    return (
      <section className="proposal-v5-print-preview-chrome rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
        Loading frozen V5 proposal snapshot...
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="proposal-v5-print-preview-chrome rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
        {state.message}
      </section>
    );
  }

  return (
    <ProposalV5PrivatePrintPreviewView
      persistedSnapshot={state.snapshot}
      persistedProposalName={state.proposalName}
    />
  );
}

export function ProposalV5PrivatePrintPreviewContent() {
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("proposalId") || searchParams.get("id");
  const { session } = useAuth();
  const token = session?.token;

  if (proposalId && !token) {
    return (
      <section className="proposal-v5-print-preview-chrome rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
        Sign in before opening a frozen proposal snapshot print preview.
      </section>
    );
  }

  if (proposalId && token) {
    return <ProposalV5PersistedSnapshotPrintPreview key={proposalId} proposalId={proposalId} token={token} />;
  }

  const caseMode = searchParams.get("case");

  return (
    <ProposalV5PrivatePrintPreviewView
      clinicTypeInput={searchParams.get("clinicType")}
      packageIdInput={searchParams.get("package") || searchParams.get("packageId")}
      longContent={caseMode === "long" || searchParams.get("long") === "1"}
      extremeContent={caseMode === "extreme" || searchParams.get("extreme") === "1"}
    />
  );
}
