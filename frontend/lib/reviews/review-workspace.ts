import type { ReviewRecord } from "@/lib/api-types";

export type ReviewWorkspaceRow = {
  author: string;
  createdAt: string;
  date: string;
  id: string;
  platform: string;
  providerReviewId: string | null;
  providerReviewName: string | null;
  rating: number | null;
  replied: boolean;
  status: string;
  text: string;
};

export type ReviewWorkspaceFilter =
  | "all reviews"
  | "needs reply"
  | "5 star"
  | "4 star"
  | "3 star & below"
  | "flagged";

export function toReviewWorkspaceRow(
  record: ReviewRecord,
): ReviewWorkspaceRow {
  const status = record.status || "new";
  const createdAt = new Date(record.createdAt);
  const rawRating = Number(record.rating);
  const rating =
    record.rating !== null &&
    Number.isFinite(rawRating) &&
    rawRating >= 1 &&
    rawRating <= 5
      ? rawRating
      : null;
  const date = Number.isNaN(createdAt.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }).format(createdAt);

  return {
    author: record.author,
    createdAt: record.createdAt,
    date,
    id: record.id,
    platform: record.source || "Manual",
    providerReviewId: record.providerReviewId || null,
    providerReviewName: record.providerReviewName || null,
    rating,
    replied: status === "replied" || status === "resolved",
    status,
    text: record.comment || "No review text provided.",
  };
}

export function reviewNeedsAttention(review: ReviewWorkspaceRow) {
  return review.status === "flagged" || !review.replied;
}

export function getReviewIssue(review: ReviewWorkspaceRow) {
  if (review.status === "flagged") return "Flagged for follow-up";
  if (
    !review.replied &&
    review.rating !== null &&
    review.rating <= 3
  ) {
    return "Low rating needs a careful response";
  }
  if (!review.replied) return "Review needs a reply";
  return null;
}

export function isGoogleReview(review: ReviewWorkspaceRow) {
  return review.platform.toLowerCase().includes("google");
}

export function filterReviewRows(
  reviews: ReviewWorkspaceRow[],
  filter: ReviewWorkspaceFilter,
  searchQuery: string,
) {
  const query = searchQuery.trim().toLowerCase();

  return reviews.filter((review) => {
    const matchesFilter =
      filter === "all reviews" ||
      (filter === "needs reply" && !review.replied) ||
      (filter === "5 star" && review.rating === 5) ||
      (filter === "4 star" && review.rating === 4) ||
      (filter === "3 star & below" &&
        review.rating !== null &&
        review.rating <= 3) ||
      (filter === "flagged" && review.status === "flagged");
    const matchesQuery =
      !query ||
      [
        review.author,
        review.text,
        review.platform,
        review.status,
        String(review.rating),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);

    return matchesFilter && matchesQuery;
  });
}

export function sortAttentionReviews(reviews: ReviewWorkspaceRow[]) {
  return reviews.filter(reviewNeedsAttention).sort((left, right) => {
    const flaggedDifference =
      Number(right.status === "flagged") - Number(left.status === "flagged");
    if (flaggedDifference !== 0) return flaggedDifference;

    const leftLowRating =
      !left.replied && left.rating !== null && left.rating <= 3;
    const rightLowRating =
      !right.replied && right.rating !== null && right.rating <= 3;
    const ratingDifference = Number(rightLowRating) - Number(leftLowRating);
    if (ratingDifference !== 0) return ratingDifference;

    return (
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    );
  });
}

export function getReviewWorkspaceStats(reviews: ReviewWorkspaceRow[]) {
  const ratedReviews = reviews.filter(
    (review): review is ReviewWorkspaceRow & { rating: number } =>
      review.rating !== null,
  );
  const replied = reviews.filter((review) => review.replied).length;
  const ratingTotal = ratedReviews.reduce(
    (total, review) => total + review.rating,
    0,
  );

  return {
    averageRating: ratedReviews.length
      ? Number((ratingTotal / ratedReviews.length).toFixed(1))
      : 0,
    flagged: reviews.filter((review) => review.status === "flagged").length,
    needsReply: reviews.length - replied,
    rated: ratedReviews.length,
    replied,
    responseRate: reviews.length
      ? Math.round((replied / reviews.length) * 100)
      : 0,
    total: reviews.length,
  };
}
