"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ProposalV5Renderer, isProposalV5Snapshot, type ProposalV5Snapshot } from "@/components/proposals/v5";
import {
  buildProposalV5PreviewSnapshot,
  listProposalV5PreviewClinicTypes,
  proposalV5PreviewPackages,
} from "@/components/proposals/v5/data/previewSnapshot";
import { getProposalV5ClinicTypeVariant, normaliseProposalV5ClinicTypeId } from "@/components/proposals/v5/data/clinicTypeVariants";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

const previewRoute = "/app/crm/proposals/v5-preview";

function optionHref(clinicType: string, packageId: string, longContent: boolean) {
  const params = new URLSearchParams();
  params.set("clinicType", clinicType);
  params.set("package", packageId);
  if (longContent) params.set("case", "long");
  return `${previewRoute}?${params.toString()}`;
}

export function ProposalV5PrivatePreviewView({
  clinicTypeInput,
  packageIdInput,
  longContent,
  persistedSnapshot,
  persistedProposalName,
}: {
  clinicTypeInput?: string | null;
  packageIdInput?: string | null;
  longContent?: boolean;
  persistedSnapshot?: ProposalV5Snapshot | null;
  persistedProposalName?: string | null;
}) {
  const clinicType = normaliseProposalV5ClinicTypeId(clinicTypeInput);
  const packageId = packageIdInput || "clinic-growth-engine";
  const fixtureSnapshot = useMemo(
    () =>
      buildProposalV5PreviewSnapshot({
        clinicType,
        packageId,
        longContent: Boolean(longContent),
      }),
    [clinicType, packageId, longContent],
  );
  const snapshot = persistedSnapshot || fixtureSnapshot;
  const clinicTypes = listProposalV5PreviewClinicTypes();
  const selectedClinicVariant = getProposalV5ClinicTypeVariant(snapshot.clinic.clinicType);
  const isPersistedPreview = Boolean(persistedSnapshot);

  return (
    <div className="proposal-v5-private-preview">
      <section
        aria-label="Private V5 preview controls"
        className="proposal-v5-private-preview-chrome mb-6 rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-[#132e35]"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f9e99]">Private internal preview</p>
            <h1 className="mt-2 text-2xl font-semibold text-[#011418]">ClinicGrower V5 proposal renderer</h1>
            <p className="mt-2 text-sm leading-6 text-[#5f777b]">
              {isPersistedPreview
                ? `Rendering the frozen V5 snapshot stored on ${persistedProposalName || "this proposal"}. This remains private and does not replace public proposal links.`
                : "This route renders the isolated V5 renderer through the real Next app for visual acceptance. It is not connected to public proposal links, the editor or customer navigation."}
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
            <div className="rounded-[6px] border border-[#c8dfdd] bg-white p-3">
              <span className="block text-[11px] font-semibold uppercase text-[#5f777b]">Snapshot</span>
              <span className="mt-1 block font-mono text-xs">{snapshot.snapshotHash}</span>
            </div>
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
                    href={optionHref(item, snapshot.selectedPackage.id || packageId, Boolean(longContent))}
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
                    href={optionHref(clinicType, item.id, Boolean(longContent))}
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
            href={optionHref(clinicType, snapshot.selectedPackage.id || packageId, false)}
            className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
              longContent ? "border-[#c8dfdd] bg-white text-[#132e35]" : "border-[#57bbb6] bg-[#dff1ef] text-[#011418]"
            }`}
          >
            Standard content
          </Link>
          <Link
            href={optionHref(clinicType, snapshot.selectedPackage.id || packageId, true)}
            className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
              longContent ? "border-[#57bbb6] bg-[#dff1ef] text-[#011418]" : "border-[#c8dfdd] bg-white text-[#132e35]"
            }`}
          >
            Long-content check
          </Link>
        </div>
      </section>

      <div className="proposal-v5-private-preview-surface overflow-x-auto pb-8">
        <div className="proposal-v5-private-preview-print-root w-fit">
          <ProposalV5Renderer snapshot={snapshot} />
        </div>
      </div>
    </div>
  );
}

function ProposalV5PersistedSnapshotPreview({
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
            message: "This proposal does not have a frozen V5 snapshot yet. Send the V5 proposal first, then reopen this preview.",
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
      <section className="proposal-v5-private-preview-chrome rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
        Loading frozen V5 proposal snapshot...
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="proposal-v5-private-preview-chrome rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
        {state.message}
      </section>
    );
  }

  return (
    <ProposalV5PrivatePreviewView
      persistedSnapshot={state.snapshot}
      persistedProposalName={state.proposalName}
    />
  );
}

export function ProposalV5PrivatePreviewContent() {
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("proposalId") || searchParams.get("id");
  const { session } = useAuth();
  const token = session?.token;

  if (proposalId && !token) {
    return (
      <section className="proposal-v5-private-preview-chrome rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-sm text-[#132e35]">
        Sign in before opening a frozen proposal snapshot preview.
      </section>
    );
  }

  if (proposalId && token) {
    return <ProposalV5PersistedSnapshotPreview key={proposalId} proposalId={proposalId} token={token} />;
  }

  return (
    <ProposalV5PrivatePreviewView
      clinicTypeInput={searchParams.get("clinicType")}
      packageIdInput={searchParams.get("package") || searchParams.get("packageId")}
      longContent={searchParams.get("case") === "long" || searchParams.get("long") === "1"}
    />
  );
}
