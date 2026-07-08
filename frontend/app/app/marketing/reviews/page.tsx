"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Star,
  MessageSquare,
  ThumbsUp,
  AlertTriangle,
  TrendingUp,
  ExternalLink,
  Reply,
  CheckCircle,
  Flag,
} from "lucide-react";
import {
  PageHeader,
  StatCard,
  Card,
  AlertBanner,
  FilterTabs,
  StatCardSkeleton,
  CardSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ReputationSummaryRecord, ReviewRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type ReviewRow = {
  id: string;
  platform: string;
  rating: number;
  author: string;
  text: string;
  date: string;
  replied: boolean;
  status: string;
};

function toReviewRow(record: ReviewRecord): ReviewRow {
  const status = record.status || "new";
  return {
    id: record.id,
    platform: record.source || "Google",
    rating: record.rating || 0,
    author: record.author,
    text: record.comment || "No review text provided.",
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(record.createdAt)),
    replied: status === "replied" || status === "resolved",
    status,
  };
}

const FILTER_TABS = [
  "All Reviews",
  "Needs Reply",
  "5 Star",
  "4 Star",
  "3 Star & Below",
  "Flagged",
];

export default function ReviewsPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [summary, setSummary] = useState<ReputationSummaryRecord | null>(null);
  const [activeFilter, setActiveFilter] = useState("all reviews");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingReviewId, setUpdatingReviewId] = useState<string | null>(null);
  const [replyingReviewId, setReplyingReviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    Promise.all([api.reviews.list(token), api.reviews.summary(token)])
      .then(([records, reputationSummary]) => {
        if (!isMounted) return;
        const rows = records.map(toReviewRow);
        setLoadError("");
        setReviews(rows);
        setSummary(reputationSummary);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load reviews from the backend.",
        );
        setReviews([]);
        setSummary(null);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const { avgRating, totalReviews, needsReplyCount } =
    useMemo(() => {
      const total = reviews.length;
      const average =
        total > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / total
          : 0;
      const replied = reviews.filter((review) => review.replied).length;
      return {
        avgRating: Number(average.toFixed(1)),
        totalReviews: total,
        needsReplyCount: total - replied,
      };
    }, [reviews]);

  const filteredReviews = useMemo(() => {
    if (activeFilter === "needs reply") {
      return reviews.filter((review) => !review.replied);
    }
    if (activeFilter === "5 star") {
      return reviews.filter((review) => review.rating === 5);
    }
    if (activeFilter === "4 star") {
      return reviews.filter((review) => review.rating === 4);
    }
    if (activeFilter === "3 star & below") {
      return reviews.filter((review) => review.rating <= 3);
    }
    if (activeFilter === "flagged") {
      return reviews.filter((review) => review.status === "flagged");
    }
    return reviews;
  }, [activeFilter, reviews]);

  const updateReviewStatus = async (review: ReviewRow, status: string) => {
    if (!token) return;

    setUpdatingReviewId(review.id);
    setActionMessage("");
    setActionError("");

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
      setActionMessage(`${review.author}'s review marked as ${status}.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update review.",
      );
    } finally {
      setUpdatingReviewId(null);
    }
  };

  const openExternalUrl = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleReplyHandoff = async (review: ReviewRow) => {
    if (!token) return;

    setReplyingReviewId(review.id);
    setActionMessage("");
    setActionError("");

    try {
      const handoff = await api.reviews.replyHandoff(token, review.id);
      if (handoff.action === "open_external" && handoff.externalUrl) {
        openExternalUrl(handoff.externalUrl);
        setActionMessage("Opened the configured review management page. Mark the review as replied after responding there.");
      } else {
        setActionError(handoff.unavailableReason);
      }
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to open review reply handoff.",
      );
    } finally {
      setReplyingReviewId(null);
    }
  };

  const handleOpenGbp = () => {
    const url = summary?.googleReviewManagementUrl || summary?.googleReviewLink;
    setActionMessage("");
    setActionError("");

    if (url) {
      openExternalUrl(url);
      setActionMessage("Opened the configured Google review management link.");
      return;
    }

    setActionError(
      summary?.gbpIntegration?.unavailableReason ||
        "Google Business Profile management link is unavailable. Add a Google review or GBP management URL in reputation settings or connector setup.",
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reviews & GBP"
        subtitle="Manage your online reputation and Google Business Profile."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <Card padding="p-4">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-[#6B7280]">Average Rating</span>
              </div>
              <p className="text-2xl font-bold text-[#111111]">{avgRating}</p>
              <div className="flex gap-0.5 mt-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${i <= Math.floor(avgRating) ? "text-amber-400 fill-amber-400" : "text-[rgba(0,0,0,0.12)]"}`}
                  />
                ))}
              </div>
            </Card>
            <StatCard
              label="Manual Reviews"
              value={String(summary?.manualReviewReceivedCount ?? totalReviews)}
              sub="Based on manually entered data"
              icon={MessageSquare}
              color="blue"
            />
            <StatCard
              label="Requests Sent"
              value={String(summary?.reviewRequestsSentCount ?? 0)}
              sub={`${summary?.reviewRequestsTotalCount ?? 0} total requests`}
              icon={ThumbsUp}
              color="indigo"
            />
            <StatCard
              label="Google Sync"
              value={summary?.googleReviewSyncConnected ? "On" : "Manual"}
              sub={
                summary?.gbpIntegration?.configured
                  ? `GBP ${summary.gbpIntegration.setupStatus}`
                  : "Google review sync is not connected"
              }
              icon={TrendingUp}
              color="green"
            />
          </>
        )}
      </div>

      <AlertBanner
        icon={AlertTriangle}
        title={`${needsReplyCount} Review${needsReplyCount === 1 ? "" : "s"} Need Attention`}
        description={summary?.gbpIntegration?.directReplyAvailable
          ? "Track and respond to connected Google reviews from here."
          : summary?.gbpIntegration?.unavailableReason ||
            "Track reply workflow from here. Direct Google review replies require GBP OAuth and review resource IDs."}
        variant="warning"
        action={
          <button
            onClick={() => setActiveFilter("needs reply")}
            className="bg-amber-500/10 text-amber-600 border border-amber-500/30 px-4 py-2 rounded-xl text-sm font-medium hover:bg-amber-500/20 transition-colors"
          >
            View & Respond
          </button>
        }
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Backend reviews could not be loaded"
          description={loadError}
          variant="warning"
        />
      )}

      {summary && (
        <Card>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div>
              <h2 className="font-semibold text-[#111111] mb-3">
                Reputation Basics
              </h2>
              <div className="space-y-3 text-sm text-[#6B7280]">
                <p>
                  Google review link:{" "}
                  <span className="font-medium text-[#111111]">
                    {summary.googleReviewLink || "Not added yet"}
                  </span>
                </p>
                <p>
                  GBP management link:{" "}
                  <span className="font-medium text-[#111111]">
                    {summary.googleReviewManagementUrl || "Not added yet"}
                  </span>
                </p>
                <p>
                  Review request template:{" "}
                  <span className="font-medium text-[#111111]">
                    {summary.reviewRequestTemplate ? "Ready" : "Not added yet"}
                  </span>
                </p>
                <p>Manual review count. Based on manually entered data.</p>
              </div>
            </div>
            <div>
              <h3 className="font-medium text-[#111111] mb-3">
                GBP checklist
              </h3>
              <div className="space-y-2">
                {summary.checklist.map((item) => (
                  <div
                    key={item.itemKey}
                    className="flex items-center gap-2 text-sm text-[#6B7280]"
                  >
                    <CheckCircle
                      className={`h-4 w-4 ${item.completed ? "text-green-600" : "text-[#A8A39B]"}`}
                    />
                    <span>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {actionMessage && (
        <AlertBanner
          icon={CheckCircle}
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

      <FilterTabs
        tabs={FILTER_TABS}
        active={activeFilter}
        onChange={setActiveFilter}
      />

      <Card padding="p-0">
        <div className="divide-y divide-[rgba(0,0,0,0.05)]">
          {isLoading &&
            Array.from({ length: 3 }, (_, index) => (
              <div key={index} className="p-5">
                <CardSkeleton lines={3} />
              </div>
            ))}
          {!isLoading && filteredReviews.map((review) => (
            <div key={review.id} className="p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium text-white flex-shrink-0"
                    style={{
                      background: "linear-gradient(135deg, #6E6AE8, #8B87F0)",
                    }}
                  >
                    {review.author
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="font-medium text-[#111111]">
                      {review.author}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Star
                            key={i}
                            className={`w-3.5 h-3.5 ${i <= review.rating ? "text-amber-400 fill-amber-400" : "text-[rgba(0,0,0,0.12)]"}`}
                          />
                        ))}
                      </div>
                      <span className="text-xs text-[#6B7280]">
                        {review.platform}
                      </span>
                      <span className="text-xs text-[#6B7280]">•</span>
                      <span className="text-xs text-[#6B7280]">
                        {review.date}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {review.replied ? (
                    <span className="text-xs bg-green-500/10 text-green-600 px-2 py-1 rounded-lg">
                      Replied
                    </span>
                  ) : (
                    <button
                      onClick={() => void handleReplyHandoff(review)}
                      disabled={replyingReviewId === review.id}
                      className="text-xs px-3 py-1.5 rounded-xl flex items-center gap-1 font-medium transition-colors text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.08)]"
                      style={{
                        backgroundColor: "rgba(110, 106, 232, 0.06)",
                        border: "1px solid rgba(110, 106, 232, 0.2)",
                      }}
                    >
                      <Reply className="w-3 h-3" /> {replyingReviewId === review.id ? "Opening..." : "Reply"}
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[#6B7280] text-sm leading-relaxed">
                {review.text}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void updateReviewStatus(review, "replied")}
                  disabled={updatingReviewId === review.id || review.replied}
                  className="rounded-xl bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-500/15 disabled:opacity-50"
                >
                  Mark Replied
                </button>
                <button
                  onClick={() => void updateReviewStatus(review, "resolved")}
                  disabled={
                    updatingReviewId === review.id ||
                    review.status === "resolved"
                  }
                  className="rounded-xl bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-500/15 disabled:opacity-50"
                >
                  Resolve
                </button>
                <button
                  onClick={() => void updateReviewStatus(review, "flagged")}
                  disabled={
                    updatingReviewId === review.id ||
                    review.status === "flagged"
                  }
                  className="rounded-xl bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-500/15 disabled:opacity-50"
                >
                  <span className="inline-flex items-center gap-1">
                    <Flag className="h-3 w-3" /> Flag
                  </span>
                </button>
              </div>
            </div>
          ))}
          {!isLoading && filteredReviews.length === 0 && (
            <div className="p-8 text-sm text-[#6B7280]">
              No reviews match this filter.
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-center">
        <button
          onClick={handleOpenGbp}
          className="text-[#6E6AE8] hover:text-[#5A56D4] text-sm font-medium flex items-center gap-1 transition-colors"
        >
          View all reviews on Google <ExternalLink className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
