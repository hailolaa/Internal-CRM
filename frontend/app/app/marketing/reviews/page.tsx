"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Flag,
  Loader2,
  MessageSquare,
  Reply,
  RotateCcw,
  Search,
  ShieldCheck,
  Star,
} from "lucide-react";
import {
  ActionButton,
  AlertBanner,
  Card,
  CardSkeleton,
  EmptyState,
  FilterTabs,
  PageHeader,
  ProgressBar,
  SearchInput,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ReputationSummaryRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  filterReviewRows,
  getReviewIssue,
  getReviewWorkspaceStats,
  isGoogleReview,
  sortAttentionReviews,
  toReviewWorkspaceRow,
  type ReviewWorkspaceFilter,
  type ReviewWorkspaceRow,
} from "@/lib/reviews/review-workspace";

const FILTER_TABS = [
  "All Reviews",
  "Needs Reply",
  "5 Star",
  "4 Star",
  "3 Star & Below",
  "Flagged",
];

function renderStars(rating: number | null, size = "h-4 w-4") {
  return [1, 2, 3, 4, 5].map((star) => (
    <Star
      key={star}
      aria-hidden="true"
      className={`${size} ${
        rating !== null && star <= rating
          ? "fill-amber-400 text-amber-400"
          : "text-[rgba(21,31,33,0.14)]"
      }`}
    />
  ));
}

function getInitials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P"
  );
}

function getUnflagStatus(review: ReviewWorkspaceRow) {
  return review.replied ? "replied" : "published";
}

function settledMessage(result: PromiseSettledResult<unknown>, fallback: string) {
  return result.status === "rejected" && result.reason instanceof Error
    ? result.reason.message
    : fallback;
}

export default function ReviewsPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canReadReviews = hasPermission("marketing:read");
  const canWriteReviews = hasPermission("marketing:write");
  const [reviews, setReviews] = useState<ReviewWorkspaceRow[]>([]);
  const [summary, setSummary] = useState<ReputationSummaryRecord | null>(null);
  const [activeFilter, setActiveFilter] =
    useState<ReviewWorkspaceFilter>("all reviews");
  const [searchQuery, setSearchQuery] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [activeReplyReviewId, setActiveReplyReviewId] = useState<string | null>(
    null,
  );
  const [replyText, setReplyText] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [reviewLoadError, setReviewLoadError] = useState("");
  const [summaryLoadError, setSummaryLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);
  const reviewRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    let isActive = true;

    async function loadReviews() {
      await Promise.resolve();
      if (!isActive) return;
      if (!token || !canReadReviews) {
        setReviews([]);
        setSummary(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setReviewLoadError("");
      setSummaryLoadError("");
      const [reviewResult, summaryResult] = await Promise.allSettled([
        api.reviews.list(token),
        api.reviews.summary(token),
      ]);
      if (!isActive) return;

      if (reviewResult.status === "fulfilled") {
        setReviews(reviewResult.value.map(toReviewWorkspaceRow));
      } else {
        setReviews([]);
        setReviewLoadError(
          settledMessage(reviewResult, "Unable to load saved reviews."),
        );
      }

      if (summaryResult.status === "fulfilled") {
        setSummary(summaryResult.value);
      } else {
        setSummary(null);
        setSummaryLoadError(
          settledMessage(
            summaryResult,
            "Unable to load Google Business Profile readiness.",
          ),
        );
      }
      setIsLoading(false);
    }

    void loadReviews();
    return () => {
      isActive = false;
    };
  }, [canReadReviews, loadAttempt, token]);

  const stats = useMemo(() => getReviewWorkspaceStats(reviews), [reviews]);
  const attentionReviews = useMemo(
    () => sortAttentionReviews(reviews),
    [reviews],
  );
  const filteredReviews = useMemo(
    () => filterReviewRows(reviews, activeFilter, searchQuery),
    [activeFilter, reviews, searchQuery],
  );
  const activeReplyReview =
    reviews.find((review) => review.id === activeReplyReviewId) || null;
  const checklistComplete = summary
    ? summary.checklist.filter((item) => item.completed).length
    : 0;
  const checklistProgress = summary?.checklist.length
    ? Math.round((checklistComplete / summary.checklist.length) * 100)
    : 0;
  const googleConnectionHealthy = Boolean(
    summary?.googleReviewSyncConnected &&
      summary.gbpIntegration?.setupStatus === "ready" &&
      summary.gbpIntegration?.healthStatus === "healthy",
  );
  const googleConnectionLabel = !summary?.googleReviewSyncConnected
    ? "Manual workflow"
    : googleConnectionHealthy
      ? "Sync healthy"
      : "Sync needs attention";
  const isMutating = Boolean(updatingReviewId || replyingReviewId);
  const hasFilters = Boolean(searchQuery.trim()) || activeFilter !== "all reviews";
  const fatalLoadError = reviewLoadError && summaryLoadError;
  const partialLoadError =
    !fatalLoadError && (reviewLoadError || summaryLoadError);

  function clearFeedback() {
    setActionMessage("");
    setActionError("");
  }

  function revealReview(reviewId: string) {
    setSearchQuery("");
    setActiveFilter("all reviews");
    setFiltersOpen(false);
    setExpandedReviewId(reviewId);
    window.setTimeout(() => {
      const row = reviewRefs.current[reviewId];
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
      row?.focus({ preventScroll: true });
    }, 0);
  }

  function openExternalUrl(url: string) {
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function handleOpenGbp() {
    clearFeedback();
    const url = summary?.googleReviewManagementUrl || summary?.googleReviewLink;
    if (url) {
      openExternalUrl(url);
      setActionMessage("Opened the configured Google review page.");
      return;
    }
    setActionError(
      summary?.gbpIntegration?.unavailableReason ||
        "A Google review or management URL is not configured yet.",
    );
  }

  async function updateReviewStatus(
    review: ReviewWorkspaceRow,
    status: string,
  ) {
    if (!token || !canWriteReviews || isMutating) return;
    setUpdatingReviewId(review.id);
    clearFeedback();

    try {
      await api.reviews.updateStatus(token, review.id, status);
      setReviews((current) =>
        current.map((item) =>
          item.id === review.id
            ? {
                ...item,
                status,
                replied: status === "replied" || status === "resolved",
              }
            : item,
        ),
      );
      if (status === "replied" || status === "resolved") {
        setActiveReplyReviewId(null);
        setReplyText("");
      }
      setActionMessage(
        status === "published"
          ? `${review.author}'s review unflagged.`
          : `${review.author}'s review marked as ${status}.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update review.",
      );
    } finally {
      setUpdatingReviewId(null);
    }
  }

  function flagReview(review: ReviewWorkspaceRow) {
    if (
      review.replied &&
      !window.confirm(
        `Reopen ${review.author}'s handled review and flag it for follow-up? It will return to the attention queue.`,
      )
    ) {
      return;
    }
    void updateReviewStatus(review, "flagged");
  }

  async function handleReplyHandoff(review: ReviewWorkspaceRow) {
    if (!token || !canWriteReviews || isMutating) return;
    setReplyingReviewId(review.id);
    clearFeedback();

    try {
      const handoff = await api.reviews.replyHandoff(token, review.id);
      if (handoff.action === "open_external" && handoff.externalUrl) {
        openExternalUrl(handoff.externalUrl);
        setActionMessage(
          "Opened Google Business Profile. Mark the review as replied after responding there.",
        );
      } else {
        setActionError(handoff.unavailableReason);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to open the review reply handoff.",
      );
    } finally {
      setReplyingReviewId(null);
    }
  }

  function canReplyDirectly(review: ReviewWorkspaceRow) {
    return Boolean(
      isGoogleReview(review) &&
        summary?.gbpIntegration?.directReplyAvailable &&
        (review.providerReviewName || review.providerReviewId),
    );
  }

  function openReplyComposer(review: ReviewWorkspaceRow) {
    clearFeedback();
    setExpandedReviewId(review.id);
    setActiveReplyReviewId(review.id);
    setReplyText(
      review.rating !== null && review.rating >= 4
        ? `Thank you for taking the time to leave us this review, ${review.author}. We really appreciate your kind words.`
        : `Thank you for sharing this feedback, ${review.author}. We are sorry this was your experience and would like to understand what happened so we can put it right.`,
    );
  }

  async function submitReviewReply() {
    if (
      !token ||
      !canWriteReviews ||
      !activeReplyReview ||
      !canReplyDirectly(activeReplyReview) ||
      !replyText.trim() ||
      isMutating
    ) {
      return;
    }

    setReplyingReviewId(activeReplyReview.id);
    clearFeedback();
    try {
      await api.reviews.reply(token, activeReplyReview.id, replyText.trim());
      setReviews((items) =>
        items.map((item) =>
          item.id === activeReplyReview.id
            ? { ...item, replied: true, status: "replied" }
            : item,
        ),
      );
      setActionMessage("Reply posted to Google Business Profile.");
      setActiveReplyReviewId(null);
      setReplyText("");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to post this reply.",
      );
    } finally {
      setReplyingReviewId(null);
    }
  }

  function clearFilters() {
    setSearchQuery("");
    setActiveFilter("all reviews");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review & GBP Signals"
        subtitle="Track client reputation, Google Business Profile signals and internal follow-up work."
        icon={Star}
        right={
          canReadReviews ? (
            <ActionButton onClick={handleOpenGbp} icon={ExternalLink}>
              Open Google
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
            title="Review action failed"
            description={actionError}
            variant="error"
          />
        )}
      </div>

      {!canReadReviews ? (
        <AlertBanner
          icon={AlertTriangle}
          title="You do not have access to reviews"
          description="Ask an administrator for marketing read access."
          variant="warning"
        />
      ) : fatalLoadError ? (
        <Card padding="p-6 sm:p-8">
          <EmptyState
            icon={AlertTriangle}
            title="Reviews could not be loaded"
            description={`${reviewLoadError} ${summaryLoadError}`}
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
          {partialLoadError && (
            <AlertBanner
              icon={AlertTriangle}
              title="Some reputation data is unavailable"
              description={partialLoadError}
              variant="warning"
              action={
                <ActionButton
                  onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                  icon={RotateCcw}
                  variant="ghost"
                  className="min-h-10 px-3"
                >
                  Retry
                </ActionButton>
              }
            />
          )}

          <Card padding="p-0" className="overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-y divide-[rgba(21,31,33,0.06)] lg:grid-cols-4 lg:divide-y-0">
              {[
                [
                  "Average rating",
                  stats.averageRating ? stats.averageRating.toFixed(1) : "—",
                  stats.averageRating
                    ? `${stats.rated} rated reviews`
                    : "No ratings loaded",
                ],
                ["Reviews", stats.total, "Saved feedback"],
                [
                  "Needs reply",
                  stats.needsReply,
                  stats.needsReply ? "Response needed" : "Inbox clear",
                ],
                [
                  "Response coverage",
                  `${stats.responseRate}%`,
                  `${stats.replied} handled`,
                ],
              ].map(([label, value, detail], index) => (
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
                      <div className="mt-1 flex flex-wrap items-center gap-x-2">
                        <p className="text-2xl font-semibold text-[#151f21]">
                          {value}
                        </p>
                        {index === 0 && stats.averageRating > 0 && (
                          <Star
                            aria-hidden="true"
                            className="h-4 w-4 fill-amber-400 text-amber-400"
                          />
                        )}
                        <p className="truncate text-xs text-[#5E6E70]">
                          {detail}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {!isLoading && attentionReviews.length > 0 && (
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
                        Prioritised feedback that still needs a decision.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-amber-700">
                      {attentionReviews.length} actionable
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                    {attentionReviews.slice(0, 4).map((review) => (
                      <button
                        key={review.id}
                        type="button"
                        onClick={() => revealReview(review.id)}
                        className="min-h-11 min-w-[220px] rounded-2xl border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-left transition-colors hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4A9A95]"
                      >
                        <span className="block truncate text-sm font-semibold text-[#151f21]">
                          {review.author}
                        </span>
                        <span className="block truncate text-xs text-[#9A5524]">
                          {getReviewIssue(review)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          )}

          <Card padding="p-0" className="overflow-hidden">
            <div className="border-b border-[rgba(21,31,33,0.06)] bg-[#FAF9F7]/60 p-4 sm:p-5">
              {isLoading ? (
                <div className="h-16 animate-pulse rounded-2xl bg-[#eaedeb]" />
              ) : summary ? (
                <>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                          googleConnectionHealthy
                            ? "bg-[#60b4af]/10"
                            : "bg-amber-500/10"
                        }`}
                      >
                        <ShieldCheck
                          className={`h-5 w-5 ${
                            googleConnectionHealthy
                              ? "text-[#151F21]"
                              : "text-amber-700"
                          }`}
                        />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-[#151f21]">
                            Google reputation setup
                          </h2>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              googleConnectionHealthy
                                ? "bg-[#60b4af]/10 text-[#151F21]"
                                : "bg-amber-500/10 text-amber-700"
                            }`}
                          >
                            {googleConnectionLabel}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-[#5E6E70]">
                          {checklistComplete} of {summary.checklist.length} setup
                          checks complete
                          {summary.reviewRequestsSentCount > 0
                            ? ` · ${summary.reviewRequestsSentCount} review requests sent`
                            : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-3 lg:min-w-[300px]">
                      <div
                        role="progressbar"
                        aria-label="Google reputation setup progress"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={checklistProgress}
                        className="min-w-0 flex-1"
                      >
                        <ProgressBar value={checklistProgress} />
                      </div>
                      <span className="text-xs font-semibold text-[#5E6E70]">
                        {checklistProgress}%
                      </span>
                      <button
                        type="button"
                        onClick={() => setSetupOpen((open) => !open)}
                        aria-expanded={setupOpen}
                        aria-controls="gbp-setup-details"
                        className="inline-flex min-h-11 items-center gap-2 rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFFFF] px-3 text-sm font-medium text-[#5E6E70] hover:bg-[#eaedeb]"
                      >
                        Details
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            setupOpen ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {setupOpen && (
                    <div
                      id="gbp-setup-details"
                      className="mt-4 grid gap-4 border-t border-[rgba(21,31,33,0.06)] pt-4 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]"
                    >
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {[
                          [
                            "Review link",
                            summary.googleReviewLink ? "Ready" : "Not added",
                          ],
                          [
                            "Reply route",
                            summary.gbpIntegration?.directReplyAvailable
                              ? "Direct reply"
                              : summary.googleReviewManagementUrl
                                ? "Google handoff"
                                : "Not ready",
                          ],
                          [
                            "Request template",
                            summary.reviewRequestTemplate
                              ? "Ready"
                              : "Not added",
                          ],
                        ].map(([label, value]) => (
                          <div
                            key={label}
                            className="rounded-2xl bg-[#FFFFFF] px-3 py-3"
                          >
                            <p className="text-[11px] uppercase tracking-[0.06em] text-[#5E6E70]">
                              {label}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-[#151f21]">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        {summary.checklist.map((item) => (
                          <div
                            key={item.itemKey}
                            className="flex items-center gap-2 text-sm text-[#5E6E70]"
                          >
                            {item.completed ? (
                              <CheckCircle2
                                aria-hidden="true"
                                className="h-4 w-4 text-[#4A9A95]"
                              />
                            ) : (
                              <span
                                aria-hidden="true"
                                className="h-4 w-4 rounded-full border-2 border-[#8A9A9C]"
                              />
                            )}
                            <span>{item.label}</span>
                            <span className="sr-only">
                              , {item.completed ? "complete" : "incomplete"}
                            </span>
                          </div>
                        ))}
                      </div>
                      {!summary.gbpIntegration?.directReplyAvailable && (
                        <p className="text-xs leading-relaxed text-[#5E6E70] lg:col-span-2">
                          {summary.gbpIntegration?.unavailableReason ||
                            "Direct Google replies require a ready Google Business Profile connection and imported review IDs."}
                        </p>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-[#5E6E70]">
                    Google reputation setup data is unavailable.
                  </p>
                  <ActionButton
                    onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                    variant="ghost"
                    icon={RotateCcw}
                  >
                    Retry
                  </ActionButton>
                </div>
              )}
            </div>

            <div className="border-b border-[rgba(21,31,33,0.06)] p-4 sm:p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <h2 className="font-semibold text-[#151f21]">
                    Review workspace
                  </h2>
                  <p className="mt-1 text-sm text-[#5E6E70]">
                    {isLoading
                      ? "Loading saved feedback…"
                      : reviewLoadError
                        ? "Saved reviews are currently unavailable"
                        : `${filteredReviews.length} of ${reviews.length} reviews shown`}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-3 xl:max-w-4xl xl:flex-row xl:items-center xl:justify-end">
                  <SearchInput
                    value={searchQuery}
                    onChange={setSearchQuery}
                    placeholder="Search contact, review or source"
                    className="w-full xl:max-w-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setFiltersOpen((open) => !open)}
                    aria-expanded={filtersOpen}
                    aria-controls="mobile-review-filters"
                    className="inline-flex min-h-11 items-center justify-between rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFFFF] px-4 text-sm font-medium text-[#5E6E70] sm:hidden"
                  >
                    {FILTER_TABS.find(
                      (filter) => filter.toLowerCase() === activeFilter,
                    )}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        filtersOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div className="hidden sm:block">
                    <FilterTabs
                      tabs={FILTER_TABS}
                      active={activeFilter}
                      onChange={(filter) =>
                        setActiveFilter(filter as ReviewWorkspaceFilter)
                      }
                    />
                  </div>
                </div>
              </div>
              {filtersOpen && (
                <div
                  id="mobile-review-filters"
                  className="mt-3 grid grid-cols-2 gap-2 sm:hidden"
                >
                  {FILTER_TABS.map((filter) => {
                    const value = filter.toLowerCase() as ReviewWorkspaceFilter;
                    const isActive = value === activeFilter;
                    return (
                      <button
                        key={filter}
                        type="button"
                        onClick={() => {
                          setActiveFilter(value);
                          setFiltersOpen(false);
                        }}
                        aria-pressed={isActive}
                        className={`min-h-11 rounded-2xl px-3 text-sm font-medium ${
                          isActive
                            ? "border border-[#60b4af]/20 bg-[#60b4af]/10 text-[#151F21]"
                            : "border border-[rgba(21,31,33,0.08)] bg-[#FFFFFF] text-[#5E6E70]"
                        }`}
                      >
                        {filter}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3 p-4 sm:p-5">
                {Array.from({ length: 3 }, (_, index) => (
                  <CardSkeleton key={index} lines={3} />
                ))}
              </div>
            ) : reviewLoadError ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={AlertTriangle}
                  title="Saved reviews could not be loaded"
                  description={reviewLoadError}
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
              </div>
            ) : reviews.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={Star}
                  title="No reviews yet"
                  description="Connected or manually entered reviews will appear here."
                />
              </div>
            ) : filteredReviews.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={Search}
                  title="No matching reviews"
                  description="Try another search term or clear the current filter."
                  action={
                    hasFilters ? (
                      <ActionButton
                        onClick={clearFilters}
                        variant="secondary"
                        icon={RotateCcw}
                        className="mx-auto"
                      >
                        Clear filters
                      </ActionButton>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <ul className="divide-y divide-[rgba(21,31,33,0.06)]">
                {filteredReviews.map((review) => {
                  const isExpanded = expandedReviewId === review.id;
                  const isReplying = activeReplyReviewId === review.id;
                  const isUpdating = updatingReviewId === review.id;
                  const isPosting = replyingReviewId === review.id;
                  const issue = getReviewIssue(review);
                  const directReplyReady = canReplyDirectly(review);

                  return (
                    <li
                      key={review.id}
                      ref={(node) => {
                        reviewRefs.current[review.id] = node;
                      }}
                      tabIndex={-1}
                      className="scroll-mt-24 px-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4A9A95] sm:px-5"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            aria-hidden="true"
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#60b4af]/10 text-sm font-semibold text-[#151F21]"
                          >
                            {getInitials(review.author)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-semibold text-[#151f21]">
                                {review.author}
                              </h3>
                              {review.replied ? (
                                <span className="rounded-full bg-[#60b4af]/10 px-2.5 py-1 text-[11px] font-semibold text-[#151F21]">
                                  Handled
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                                  Needs reply
                                </span>
                              )}
                              {review.status === "flagged" && (
                                <span className="rounded-full bg-[#9a5524]/10 px-2.5 py-1 text-[11px] font-semibold text-[#9a5524]">
                                  Flagged
                                </span>
                              )}
                            </div>
                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              <div
                                className="flex gap-0.5"
                                role="img"
                                aria-label={
                                  review.rating === null
                                    ? "No rating available"
                                    : `${review.rating} out of 5 stars`
                                }
                              >
                                {renderStars(
                                  review.rating,
                                  "h-3.5 w-3.5",
                                )}
                              </div>
                              <span className="text-xs text-[#5E6E70]">
                                {review.platform}
                              </span>
                              <span
                                aria-hidden="true"
                                className="text-xs text-[#8A9A9C]"
                              >
                                ·
                              </span>
                              <span className="text-xs text-[#5E6E70]">
                                {review.date}
                              </span>
                            </div>
                            <p className="mt-3 text-sm leading-relaxed text-[#5E6E70]">
                              {review.text}
                            </p>
                          </div>
                        </div>

                        {canWriteReviews && (
                          <button
                            type="button"
                            onClick={() => {
                              setExpandedReviewId(
                                isExpanded ? null : review.id,
                              );
                              if (isExpanded) {
                                setActiveReplyReviewId(null);
                                setReplyText("");
                              }
                            }}
                            aria-expanded={isExpanded}
                            aria-controls={`review-actions-${review.id}`}
                            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[rgba(21,31,33,0.08)] bg-[#FFFFFF] px-4 text-sm font-medium text-[#5E6E70] transition-colors hover:bg-[#eaedeb]"
                          >
                            Manage
                            <ChevronDown
                              className={`h-4 w-4 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {canWriteReviews && isExpanded && (
                        <div
                          id={`review-actions-${review.id}`}
                          className="mt-4 rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FAF9F7] p-4"
                        >
                          {isReplying ? (
                            <div>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-[#151f21]">
                                    Reply to {review.author}
                                  </p>
                                  <p className="mt-1 text-xs text-[#5E6E70]">
                                    This editable reply will be posted directly
                                    to Google Business Profile.
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveReplyReviewId(null);
                                    setReplyText("");
                                  }}
                                  className="min-h-11 rounded-2xl px-3 text-sm font-medium text-[#5E6E70] hover:bg-[#eaedeb]"
                                >
                                  Cancel
                                </button>
                              </div>
                              <label
                                htmlFor={`review-reply-${review.id}`}
                                className="mt-4 block text-xs font-semibold text-[#151f21]"
                              >
                                Reply message
                              </label>
                              <textarea
                                id={`review-reply-${review.id}`}
                                value={replyText}
                                onChange={(event) =>
                                  setReplyText(event.target.value)
                                }
                                rows={5}
                                maxLength={4096}
                                className="mt-2 w-full resize-y rounded-2xl border border-[rgba(96,180,175,0.22)] bg-white px-4 py-3 text-sm leading-relaxed text-[#151f21] outline-none transition-colors focus:border-[#4A9A95] focus:ring-2 focus:ring-[#4A9A95]/10"
                                placeholder="Write the reply that will be posted to Google…"
                              />
                              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-xs text-[#5E6E70]">
                                  {replyText.length}/4096 characters
                                </p>
                                <div className="flex flex-wrap gap-2">
                                  <ActionButton
                                    onClick={() =>
                                      void handleReplyHandoff(review)
                                    }
                                    variant="secondary"
                                    icon={ExternalLink}
                                    disabled={isMutating}
                                  >
                                    Open Google
                                  </ActionButton>
                                  <ActionButton
                                    onClick={() => void submitReviewReply()}
                                    icon={isPosting ? Loader2 : Reply}
                                    disabled={isMutating || !replyText.trim()}
                                    className={
                                      isPosting
                                        ? "[&>svg]:animate-spin"
                                        : ""
                                    }
                                  >
                                    {isPosting ? "Posting…" : "Post reply"}
                                  </ActionButton>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#151f21]">
                                  {issue || "Review is handled"}
                                </p>
                                <p className="mt-1 text-xs leading-relaxed text-[#5E6E70]">
                                  {directReplyReady
                                    ? "A direct Google reply is available for this imported review."
                                    : isGoogleReview(review)
                                      ? "Use the Google handoff or update the response status after replying externally."
                                      : "Direct posting is not supported for this review source."}
                                </p>
                              </div>
                              <div className="flex flex-wrap gap-2 sm:justify-end">
                                {!review.replied && directReplyReady && (
                                  <ActionButton
                                    onClick={() => openReplyComposer(review)}
                                    icon={Reply}
                                    disabled={isMutating}
                                  >
                                    Reply
                                  </ActionButton>
                                )}
                                {!review.replied &&
                                  isGoogleReview(review) &&
                                  !directReplyReady && (
                                    <ActionButton
                                      onClick={() =>
                                        void handleReplyHandoff(review)
                                      }
                                      variant="secondary"
                                      icon={
                                        isPosting ? Loader2 : ExternalLink
                                      }
                                      disabled={isMutating}
                                      className={
                                        isPosting
                                          ? "[&>svg]:animate-spin"
                                          : ""
                                      }
                                    >
                                      Reply in Google
                                    </ActionButton>
                                  )}
                                {!review.replied && (
                                  <ActionButton
                                    onClick={() =>
                                      void updateReviewStatus(
                                        review,
                                        "replied",
                                      )
                                    }
                                    variant="secondary"
                                    disabled={isMutating}
                                    icon={isUpdating ? Loader2 : CheckCircle2}
                                    className={
                                      isUpdating
                                        ? "[&>svg]:animate-spin"
                                        : ""
                                    }
                                  >
                                    Mark replied
                                  </ActionButton>
                                )}
                                {review.status !== "resolved" && (
                                  <ActionButton
                                    onClick={() =>
                                      void updateReviewStatus(
                                        review,
                                        "resolved",
                                      )
                                    }
                                    variant="ghost"
                                    disabled={isMutating}
                                  >
                                    Resolve
                                  </ActionButton>
                                )}
                                {review.status === "flagged" ? (
                                  <ActionButton
                                    onClick={() =>
                                      void updateReviewStatus(
                                        review,
                                        getUnflagStatus(review),
                                      )
                                    }
                                    variant="ghost"
                                    disabled={isMutating}
                                    icon={Flag}
                                  >
                                    Unflag
                                  </ActionButton>
                                ) : (
                                  <ActionButton
                                    onClick={() => flagReview(review)}
                                    variant="ghost"
                                    disabled={isMutating}
                                    icon={Flag}
                                  >
                                    {review.replied ? "Reopen & flag" : "Flag"}
                                  </ActionButton>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          {!isLoading && summary && (
            <p className="flex items-center gap-2 px-1 text-xs text-[#5E6E70]">
              <MessageSquare className="h-3.5 w-3.5" />
              {summary.manualReviewReceivedCount} manually recorded reviews ·{" "}
              {summary.reviewRequestsTotalCount} review requests tracked
            </p>
          )}
        </>
      )}
    </div>
  );
}
