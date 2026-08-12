"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ProposalV5MobileRenderer,
  ProposalV5PrintRenderer,
  ProposalV5Renderer,
  isProposalV5Snapshot,
  type ProposalV5Snapshot,
} from "@/components/proposals/v5";
import { api } from "@/lib/api-client";
import type { ProposalRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

export type ProposalV5InternalRenderer = "v5" | "v5-mobile" | "v5-print";

type SnapshotResolution =
  | {
      status: "ready";
      snapshot: ProposalV5Snapshot;
    }
  | {
      status: "missing_snapshot" | "invalid" | "unsupported_status";
      title: string;
      message: string;
    };

const frozenPreviewStatuses = new Set<ProposalRecord["status"]>([
  "ready",
  "sent",
  "viewed",
  "follow_up_due",
  "accepted",
  "won",
  "lost",
  "expired",
]);

const rendererLabels: Record<ProposalV5InternalRenderer, string> = {
  v5: "Desktop V5",
  "v5-mobile": "Mobile V5",
  "v5-print": "Print/PDF V5",
};

function NoIndexMeta() {
  useEffect(() => {
    const existing = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const previousContent = existing?.getAttribute("content") || null;
    const meta = existing || document.createElement("meta");
    meta.setAttribute("name", "robots");
    meta.setAttribute("content", "noindex,nofollow");
    if (!existing) document.head.appendChild(meta);

    return () => {
      if (existing && previousContent !== null) {
        existing.setAttribute("content", previousContent);
        return;
      }
      meta.remove();
    };
  }, []);

  return null;
}

export function normaliseProposalV5InternalRenderer(value: string | null | undefined): ProposalV5InternalRenderer | null {
  if (value === "v5" || value === "v5-mobile" || value === "v5-print") return value;
  return null;
}

export function isSupportedProposalV5InternalRenderer(value: string | null | undefined): value is ProposalV5InternalRenderer {
  return normaliseProposalV5InternalRenderer(value) !== null;
}

export function resolveProposalV5FrozenSnapshot(proposal: ProposalRecord): SnapshotResolution {
  if (!proposal.v5Snapshot) {
    return {
      status: "missing_snapshot",
      title: "V5 preview unavailable",
      message: "This proposal does not have a frozen V5 snapshot. Send the proposal from the V5 workflow to freeze the client-facing version before previewing it.",
    };
  }

  if (!isProposalV5Snapshot(proposal.v5Snapshot)) {
    return {
      status: "invalid",
      title: "V5 snapshot is invalid",
      message: "The stored V5 snapshot is not structurally valid, so Mission Control has stopped before rendering it.",
    };
  }

  if (!proposal.v5SnapshotHash || !proposal.v5SnapshotVersion || !proposal.v5SnapshotFrozenAt) {
    return {
      status: "invalid",
      title: "V5 snapshot metadata is incomplete",
      message: "The proposal has V5 content but is missing the frozen version metadata required for internal preview.",
    };
  }

  if (proposal.v5Snapshot.snapshotHash !== proposal.v5SnapshotHash) {
    return {
      status: "invalid",
      title: "V5 snapshot integrity check failed",
      message: "The stored V5 snapshot does not match the frozen proposal hash. It must be reviewed before previewing.",
    };
  }

  if (!frozenPreviewStatuses.has(proposal.status)) {
    return {
      status: "unsupported_status",
      title: "V5 preview is not available for this status",
      message: "This real-record V5 preview only opens proposals with a frozen client-facing snapshot.",
    };
  }

  return {
    status: "ready",
    snapshot: proposal.v5Snapshot,
  };
}

function safeLoadErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.trim() : "";
  if (!message) return "This proposal could not be loaded. Check your access and try again.";
  if (/not found|unauthori[sz]ed|forbidden|permission|access/i.test(message)) return message;
  return "This proposal could not be loaded. Check your access and try again.";
}

function rendererHref(basePath: string, proposalId: string, renderer: ProposalV5InternalRenderer) {
  const params = new URLSearchParams();
  params.set("id", proposalId);
  params.set("renderer", renderer);
  return `${basePath}?${params.toString()}`;
}

export function ProposalV5RealRecordPreviewIssue({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <main className="min-h-screen bg-[#f4fafa] px-4 py-8 text-[#132e35] sm:px-6 lg:px-8">
      <NoIndexMeta />
      <section className="mx-auto max-w-3xl rounded-[8px] border border-[#c8dfdd] bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f9e99]">Internal V5 preview</p>
        <h1 className="mt-3 text-2xl font-semibold text-[#011418]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#5f777b]">{message}</p>
        <Link
          href="/app/crm/proposals"
          className="mt-5 inline-flex rounded-[6px] border border-[#011418] bg-[#011418] px-4 py-2 text-sm font-semibold text-white"
        >
          Back to proposals
        </Link>
      </section>
    </main>
  );
}

function RealRecordPreviewChrome({
  proposal,
  renderer,
  basePath,
}: {
  proposal: ProposalRecord;
  renderer: ProposalV5InternalRenderer;
  basePath: string;
}) {
  const printProposal = () => {
    const previousTitle = document.title;
    document.title = `ClinicGrower V5 Proposal - ${proposal.proposalName || "Preview"}`;
    window.print();
    window.setTimeout(() => {
      document.title = previousTitle;
    }, 250);
  };

  return (
    <section
      aria-label="Internal frozen V5 preview controls"
      className="proposal-v5-real-record-preview-chrome mb-6 rounded-[8px] border border-[#c8dfdd] bg-[#f4fafa] p-5 text-[#132e35]"
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#2f9e99]">Internal frozen preview</p>
          <h1 className="mt-2 text-2xl font-semibold text-[#011418]">{rendererLabels[renderer]}</h1>
          <p className="mt-2 text-sm leading-6 text-[#5f777b]">
            Rendering the persisted V5 snapshot stored on this CRM proposal. This preview does not rebuild from editor fields,
            package catalogue changes, proof asset changes or clinic-variant changes.
          </p>
        </div>
        <div className="grid gap-2 text-sm text-[#132e35] xl:min-w-[280px]">
          <div className="rounded-[6px] border border-[#c8dfdd] bg-white p-3">
            <span className="block text-[11px] font-semibold uppercase text-[#5f777b]">Proposal</span>
            <span className="mt-1 block font-semibold">{proposal.proposalName}</span>
          </div>
          <div className="rounded-[6px] border border-[#c8dfdd] bg-white p-3">
            <span className="block text-[11px] font-semibold uppercase text-[#5f777b]">Status</span>
            <span className="mt-1 block font-semibold">{proposal.status.replace(/_/g, " ")}</span>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {(Object.keys(rendererLabels) as ProposalV5InternalRenderer[]).map((item) => (
          <Link
            key={item}
            href={rendererHref(basePath, proposal.id, item)}
            className={`rounded-[6px] border px-3 py-2 text-xs font-semibold ${
              renderer === item
                ? "border-[#011418] bg-[#011418] text-white"
                : "border-[#c8dfdd] bg-white text-[#132e35] hover:border-[#2f9e99]"
            }`}
          >
            {rendererLabels[item]}
          </Link>
        ))}
        {renderer === "v5-print" ? (
          <button
            type="button"
            onClick={printProposal}
            className="rounded-[6px] border border-[#2f9e99] bg-[#2f9e99] px-3 py-2 text-xs font-semibold text-white"
          >
            Print / save PDF
          </button>
        ) : null}
      </div>
    </section>
  );
}

function ProposalV5RealRecordRenderer({
  snapshot,
  renderer,
}: {
  snapshot: ProposalV5Snapshot;
  renderer: ProposalV5InternalRenderer;
}) {
  if (renderer === "v5-mobile") {
    return (
      <div className="mx-auto w-full max-w-[430px] pb-8">
        <ProposalV5MobileRenderer snapshot={snapshot} />
      </div>
    );
  }

  if (renderer === "v5-print") {
    return (
      <div className="proposal-v5-print-preview proposal-v5-real-record-print-preview">
        <div className="proposal-v5-print-preview-surface overflow-x-auto pb-8">
          <ProposalV5PrintRenderer snapshot={snapshot} />
        </div>
      </div>
    );
  }

  return (
    <div className="proposal-v5-real-record-preview-surface overflow-x-auto pb-8">
      <div className="w-fit">
        <ProposalV5Renderer snapshot={snapshot} />
      </div>
    </div>
  );
}

export function ProposalV5RealRecordPreviewView({
  proposal,
  renderer,
  basePath = "/app/crm/proposals/preview",
}: {
  proposal: ProposalRecord;
  renderer: ProposalV5InternalRenderer;
  basePath?: string;
}) {
  const snapshotResult = resolveProposalV5FrozenSnapshot(proposal);

  if (snapshotResult.status !== "ready") {
    return <ProposalV5RealRecordPreviewIssue title={snapshotResult.title} message={snapshotResult.message} />;
  }

  return (
    <main className="proposal-v5-real-record-preview min-h-screen bg-[#f5f6f1] px-4 py-6 sm:px-6 lg:px-8">
      <NoIndexMeta />
      <RealRecordPreviewChrome proposal={proposal} renderer={renderer} basePath={basePath} />
      <ProposalV5RealRecordRenderer snapshot={snapshotResult.snapshot} renderer={renderer} />
    </main>
  );
}

export function ProposalV5RealRecordPreviewContent({
  proposalId,
  rendererParam,
  basePath = "/app/crm/proposals/preview",
}: {
  proposalId: string;
  rendererParam: string | null;
  basePath?: string;
}) {
  const renderer = normaliseProposalV5InternalRenderer(rendererParam);
  const { session } = useAuth();
  const token = session?.token;
  const [state, setState] = useState<{
    status: "idle" | "loading" | "ready" | "error";
    proposal: ProposalRecord | null;
    message: string;
  }>({
    status: "idle",
    proposal: null,
    message: "",
  });

  useEffect(() => {
    let cancelled = false;

    if (!renderer || !proposalId.trim() || !token) {
      return () => {
        cancelled = true;
      };
    }

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setState({ status: "loading", proposal: null, message: "" });
      api.proposals.get(token, proposalId.trim())
        .then((proposal) => {
          if (cancelled) return;
          setState({ status: "ready", proposal, message: "" });
        })
        .catch((error: unknown) => {
          if (cancelled) return;
          setState({
            status: "error",
            proposal: null,
            message: safeLoadErrorMessage(error),
          });
        });
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [proposalId, renderer, token]);

  if (!renderer) {
    return (
      <ProposalV5RealRecordPreviewIssue
        title="Unsupported V5 renderer"
        message="Use renderer=v5, renderer=v5-mobile or renderer=v5-print for the internal frozen V5 preview."
      />
    );
  }

  if (!proposalId.trim()) {
    return (
      <ProposalV5RealRecordPreviewIssue
        title="Proposal ID required"
        message="Open this preview from a saved CRM proposal so Mission Control can load the frozen V5 snapshot."
      />
    );
  }

  if (!token) {
    return (
      <ProposalV5RealRecordPreviewIssue
        title="Sign in required"
        message="Sign in to Mission Control before opening a real-record V5 proposal preview."
      />
    );
  }

  if (state.status === "loading" || state.status === "idle") {
    return (
      <main className="min-h-screen bg-[#f4fafa] px-4 py-8 text-[#132e35] sm:px-6 lg:px-8">
        <section className="mx-auto max-w-3xl rounded-[8px] border border-[#c8dfdd] bg-white p-6 text-sm">
          Loading frozen V5 proposal snapshot...
        </section>
      </main>
    );
  }

  if (state.status === "error" || !state.proposal) {
    return <ProposalV5RealRecordPreviewIssue title="Proposal could not be loaded" message={state.message} />;
  }

  return <ProposalV5RealRecordPreviewView proposal={state.proposal} renderer={renderer} basePath={basePath} />;
}

export function ProposalV5RealRecordPreviewRouteContent({
  basePath = "/app/crm/proposals/v5-record-preview",
}: {
  basePath?: string;
}) {
  const searchParams = useSearchParams();
  return (
    <ProposalV5RealRecordPreviewContent
      proposalId={searchParams.get("proposalId") || searchParams.get("id") || ""}
      rendererParam={searchParams.get("renderer")}
      basePath={basePath}
    />
  );
}
