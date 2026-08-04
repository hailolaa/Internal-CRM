"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Gift,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Tag,
} from "lucide-react";
import {
  ActionButton,
  AlertBanner,
  Card,
  CardSkeleton,
  EmptyState,
  FilterTabs,
  PageHeader,
  SearchInput,
  StatusBadge,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { OfferRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const FILTER_TABS = ["All", "Active", "Scheduled", "Needs Attention", "Expired"];
const DAY_MS = 86_400_000;

function parseOfferDate(value: string) {
  if (!value || value === "No expiry") return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function daysUntilExpiry(offer: OfferRecord) {
  const expiry = parseOfferDate(offer.validUntil);
  if (!expiry) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - today.getTime()) / DAY_MS);
}

function offerIssue(offer: OfferRecord) {
  const days = daysUntilExpiry(offer);
  if (offer.status === "active" && days !== null && days < 0) {
    return `${Math.abs(days)} days past its valid date while still active`;
  }
  if (offer.status === "active" && days !== null && days <= 7) {
    return days === 0 ? "Expires today" : `Expires in ${days} days`;
  }
  if (offer.status === "active" && offer.redemptions === 0) {
    return "Active with no redemptions recorded";
  }
  if (!offer.description?.trim()) return "Missing an internal positioning note";
  return null;
}

function expiryLabel(offer: OfferRecord) {
  if (offer.validUntil === "No expiry") return "No expiry";
  const days = daysUntilExpiry(offer);
  if (days === null) return offer.validUntil;
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Expires today";
  return `${days}d remaining`;
}

export default function OffersPage() {
  const router = useRouter();
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canReadOffers = hasPermission("marketing:read");
  const canWriteOffers = hasPermission("marketing:write");
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingOfferId, setUpdatingOfferId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const offerRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    let isActive = true;
    async function loadOffers() {
      await Promise.resolve();
      if (!isActive) return;
      if (!token || !canReadOffers) {
        setOffers([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");
      try {
        const records = await api.offers.list(token);
        if (isActive) setOffers(records);
      } catch (error) {
        if (!isActive) return;
        setOffers([]);
        setLoadError(
          error instanceof Error ? error.message : "Unable to load offers.",
        );
      } finally {
        if (isActive) setIsLoading(false);
      }
    }

    void loadOffers();

    return () => {
      isActive = false;
    };
  }, [canReadOffers, loadAttempt, token]);

  const summary = useMemo(() => {
    const active = offers.filter((offer) => offer.status === "active").length;
    const scheduled = offers.filter(
      (offer) => offer.status === "scheduled",
    ).length;
    const redemptions = offers.reduce(
      (total, offer) => total + offer.redemptions,
      0,
    );
    const attention = offers.filter((offer) => offerIssue(offer));
    return { active, scheduled, redemptions, attention };
  }, [offers]);

  const filteredOffers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return offers.filter((offer) => {
      const matchesFilter =
        activeFilter === "all" ||
        (activeFilter === "needs attention"
          ? Boolean(offerIssue(offer))
          : offer.status === activeFilter);
      const matchesQuery =
        !query ||
        [offer.name, offer.treatment, offer.discount, offer.description || ""]
          .join(" ")
          .toLowerCase()
          .includes(query);
      return matchesFilter && matchesQuery;
    });
  }, [activeFilter, offers, searchQuery]);

  function revealOffer(offerId: string) {
    setSearchQuery("");
    setActiveFilter("all");
    setExpandedOfferId(offerId);
    window.setTimeout(() => {
      offerRefs.current[offerId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 0);
  }

  async function updateOffer(
    offer: OfferRecord,
    payload: Partial<OfferRecord>,
    message: string,
  ) {
    if (!token || !canWriteOffers || updatingOfferId) return;
    setUpdatingOfferId(offer.id);
    setActionMessage("");
    setActionError("");
    try {
      await api.offers.update(token, offer.id, payload);
      setOffers((current) =>
        current.map((item) =>
          item.id === offer.id ? { ...item, ...payload } : item,
        ),
      );
      setActionMessage(message);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update offer.",
      );
    } finally {
      setUpdatingOfferId(null);
    }
  }

  async function archiveOffer(offer: OfferRecord) {
    if (
      !token ||
      !canWriteOffers ||
      updatingOfferId ||
      !window.confirm(
        `Archive “${offer.name}”? Its redemption history will be preserved.`,
      )
    ) {
      return;
    }

    setUpdatingOfferId(offer.id);
    setActionMessage("");
    setActionError("");
    try {
      await api.offers.remove(token, offer.id);
      setOffers((current) => current.filter((item) => item.id !== offer.id));
      setExpandedOfferId(null);
      setActionMessage(`${offer.name} archived.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to archive offer.",
      );
    } finally {
      setUpdatingOfferId(null);
    }
  }

  const hasFilters = Boolean(searchQuery) || activeFilter !== "all";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        subtitle="Keep promotions current and track the redemptions that matter."
        icon={Gift}
        right={
          canWriteOffers ? (
            <ActionButton
              onClick={() => router.push("/app/marketing/offers/new")}
              icon={Plus}
            >
              Create offer
            </ActionButton>
          ) : undefined
        }
      />

      <div aria-live="polite" className="space-y-3">
        {actionMessage && (
          <AlertBanner
            icon={CheckCircle2}
            title={actionMessage}
            variant="success"
          />
        )}
        {actionError && (
          <AlertBanner
            icon={AlertTriangle}
            title="Offer action failed"
            description={actionError}
            variant="error"
          />
        )}
      </div>

      {!canReadOffers ? (
        <AlertBanner
          icon={AlertTriangle}
          title="You do not have access to offers"
          description="Ask an administrator for marketing read access."
          variant="warning"
        />
      ) : loadError ? (
        <Card padding="p-6 sm:p-8">
          <EmptyState
            icon={AlertTriangle}
            title="Offers could not be loaded"
            description={loadError}
            action={
              <ActionButton
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                icon={RotateCcw}
                className="mx-auto"
              >
                Try again
              </ActionButton>
            }
          />
        </Card>
      ) : (
        <>
          <Card padding="p-0" className="overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-y divide-[rgba(21,31,33,0.06)] lg:grid-cols-4 lg:divide-y-0">
              {[
                ["Offers", offers.length, `${summary.scheduled} scheduled`],
                ["Active", summary.active, "Currently available"],
                ["Redemptions", summary.redemptions, "Recorded to date"],
                [
                  "Needs attention",
                  summary.attention.length,
                  summary.attention.length ? "Review recommended" : "All clear",
                ],
              ].map(([label, value, detail]) => (
                <div key={label} className="min-w-0 px-4 py-4 sm:px-5">
                  {isLoading ? (
                    <div className="space-y-2">
                      <div className="h-3 w-20 animate-pulse rounded bg-[#eaedeb]" />
                      <div className="h-7 w-12 animate-pulse rounded bg-[#eaedeb]" />
                    </div>
                  ) : (
                    <>
                      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5E6E70]">
                        {label}
                      </p>
                      <div className="mt-1 flex flex-wrap items-baseline gap-x-2">
                        <p className="text-2xl font-semibold text-[#151f21]">
                          {value}
                        </p>
                        <p className="truncate text-xs text-[#5E6E70]">{detail}</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {!isLoading && summary.attention.length > 0 && (
            <Card padding="p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10">
                  <AlertTriangle className="h-5 w-5 text-amber-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <h2 className="font-semibold text-[#151f21]">
                        Attention queue
                      </h2>
                      <p className="mt-0.5 text-sm text-[#5E6E70]">
                        Start with the promotions most likely to need a decision.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-amber-700">
                      {summary.attention.length} flagged
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {summary.attention.slice(0, 4).map((offer) => (
                      <button
                        key={offer.id}
                        type="button"
                        onClick={() => revealOffer(offer.id)}
                        className="min-h-11 min-w-[220px] rounded-2xl border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-left transition-colors hover:bg-amber-50"
                      >
                        <span className="block truncate text-sm font-semibold text-[#151f21]">
                          {offer.name}
                        </span>
                        <span className="block truncate text-xs text-[#9A5524]">
                          {offerIssue(offer)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card padding="p-0" className="overflow-hidden">
            <div className="border-b border-[rgba(21,31,33,0.06)] p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="font-semibold text-[#151f21]">
                    Offer workspace
                  </h2>
                  <p className="mt-1 text-sm text-[#5E6E70]">
                    {isLoading
                      ? "Loading saved promotions…"
                      : `${filteredOffers.length} of ${offers.length} offers shown`}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 xl:max-w-4xl xl:flex-row xl:items-center xl:justify-end">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search name, service/package or discount"
                    className="w-full xl:max-w-sm"
                  />
                  <FilterTabs
                    tabs={FILTER_TABS}
                    active={activeFilter}
                    onChange={setActiveFilter}
                  />
                </div>
              </div>
            </div>

            {isLoading ? (
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <CardSkeleton lines={4} />
                <CardSkeleton lines={4} />
              </div>
            ) : offers.length === 0 ? (
              <EmptyState
                icon={Gift}
                title="No offers yet"
                description="Create your first internal offer to track its lifecycle and follow-up."
                action={
                  canWriteOffers ? (
                    <ActionButton
                      onClick={() => router.push("/app/marketing/offers/new")}
                      icon={Plus}
                      className="mx-auto"
                    >
                      Create offer
                    </ActionButton>
                  ) : undefined
                }
              />
            ) : filteredOffers.length === 0 ? (
              <EmptyState
                icon={Search}
                title="No matching offers"
                description="Try another search term or clear the current filter."
                action={
                  hasFilters ? (
                    <ActionButton
                      onClick={() => {
                        setSearchQuery("");
                        setActiveFilter("all");
                      }}
                      variant="secondary"
                      icon={RotateCcw}
                      className="mx-auto"
                    >
                      Clear filters
                    </ActionButton>
                  ) : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-[rgba(21,31,33,0.06)]">
                {filteredOffers.map((offer) => {
                  const isExpanded = expandedOfferId === offer.id;
                  const isUpdating = updatingOfferId === offer.id;
                  const issue = offerIssue(offer);
                  return (
                    <li
                      key={offer.id}
                      ref={(node) => {
                        offerRefs.current[offer.id] = node;
                      }}
                      className="scroll-mt-24 px-4 py-4 sm:px-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#60b4af]/10">
                            <Gift className="h-5 w-5 text-[#4A9A95]" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-[#151f21]">
                                {offer.name}
                              </h3>
                              <StatusBadge status={offer.status} />
                              {issue && (
                                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                  Review
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-[#5E6E70]">
                              {offer.treatment}
                              {offer.description?.trim()
                                ? ` · ${offer.description}`
                                : ""}
                            </p>
                          </div>
                        </div>

                        <dl className="grid grid-cols-3 gap-2 sm:min-w-[390px]">
                          <div className="rounded-2xl bg-[#FAF9F7] px-3 py-2.5">
                            <dt className="text-[11px] uppercase tracking-[0.06em] text-[#5E6E70]">
                              Discount
                            </dt>
                            <dd className="mt-0.5 truncate text-sm font-semibold text-[#151f21]">
                              {offer.discount}
                            </dd>
                          </div>
                          <div className="rounded-2xl bg-[#FAF9F7] px-3 py-2.5">
                            <dt className="text-[11px] uppercase tracking-[0.06em] text-[#5E6E70]">
                              Validity
                            </dt>
                            <dd className="mt-0.5 truncate text-sm font-semibold text-[#151f21]">
                              {expiryLabel(offer)}
                            </dd>
                          </div>
                          <div className="rounded-2xl bg-[#FAF9F7] px-3 py-2.5">
                            <dt className="text-[11px] uppercase tracking-[0.06em] text-[#5E6E70]">
                              Redeemed
                            </dt>
                            <dd className="mt-0.5 text-sm font-semibold text-[#151f21]">
                              {offer.redemptions}
                            </dd>
                          </div>
                        </dl>

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedOfferId(isExpanded ? null : offer.id)
                          }
                          aria-expanded={isExpanded}
                          aria-controls={`offer-actions-${offer.id}`}
                          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFFFF] px-4 text-sm font-medium text-[#5E6E70] transition-colors hover:bg-[#eaedeb]"
                        >
                          {canWriteOffers ? "Manage" : "Details"}
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>

                      {isExpanded && (
                        <div
                          id={`offer-actions-${offer.id}`}
                          className="mt-4 rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FAF9F7] p-4"
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#151f21]">
                                {issue || "Offer is ready"}
                              </p>
                              <p className="mt-1 text-sm text-[#5E6E70]">
                                Valid until {offer.validUntil}.{" "}
                                {offer.description?.trim() ||
                                  "No internal positioning note has been added."}
                              </p>
                            </div>
                            {canWriteOffers && (
                              <div className="flex flex-wrap gap-2 sm:justify-end">
                                <ActionButton
                                  variant="secondary"
                                  onClick={() =>
                                    void updateOffer(
                                      offer,
                                      {
                                        redemptions: offer.redemptions + 1,
                                      },
                                      `Recorded a redemption for ${offer.name}.`,
                                    )
                                  }
                                  disabled={Boolean(updatingOfferId)}
                                  icon={isUpdating ? Loader2 : Tag}
                                  className={isUpdating ? "[&>svg]:animate-spin" : ""}
                                >
                                  Redeem +1
                                </ActionButton>
                                <ActionButton
                                  variant="secondary"
                                  onClick={() =>
                                    router.push(
                                      `/app/marketing/offers/new?id=${offer.id}`,
                                    )
                                  }
                                  disabled={Boolean(updatingOfferId)}
                                >
                                  Edit offer
                                </ActionButton>
                                {(["active", "scheduled", "expired"] as const)
                                  .filter((status) => status !== offer.status)
                                  .map((status) => (
                                    <ActionButton
                                      key={status}
                                      variant="ghost"
                                      onClick={() =>
                                        void updateOffer(
                                          offer,
                                          { status },
                                          `${offer.name} marked as ${status}.`,
                                        )
                                      }
                                      disabled={Boolean(updatingOfferId)}
                                    >
                                      Mark {status}
                                    </ActionButton>
                                  ))}
                                <ActionButton
                                  variant="danger"
                                  onClick={() => void archiveOffer(offer)}
                                  disabled={Boolean(updatingOfferId)}
                                >
                                  Archive
                                </ActionButton>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {!isLoading && offers.length > 0 && (
            <p className="flex items-center gap-2 px-1 text-xs text-[#5E6E70]">
              <CalendarDays className="h-3.5 w-3.5" />
              Expiry health uses each offer’s saved valid-until date.
            </p>
          )}
        </>
      )}
    </div>
  );
}
