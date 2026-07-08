"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Gift,
  Calendar,
  Tag,
  CheckCircle,
  AlertTriangle,
  MoreHorizontal,
} from "lucide-react";
import {
  AlertBanner,
  PageHeader,
  Card,
  CardSkeleton,
  StatusBadge,
  StatCard,
  StatCardSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { OfferRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

export default function OffersPage() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const [offers, setOffers] = useState<OfferRecord[]>([]);
  const [openActionsOfferId, setOpenActionsOfferId] = useState<string | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingOfferId, setUpdatingOfferId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    api.offers
      .list(token)
      .then((records) => {
        if (!isMounted) return;
        setLoadError("");
        setOffers(records);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load offers from the backend.",
        );
        setOffers([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const activeOffers = offers.filter((offer) => offer.status === "active").length;
  const scheduledOffers = offers.filter(
    (offer) => offer.status === "scheduled",
  ).length;
  const expiredOffers = offers.filter((offer) => offer.status === "expired").length;
  const totalRedemptions = offers.reduce(
    (sum, offer) => sum + offer.redemptions,
    0,
  );

  const updateOffer = async (
    offer: OfferRecord,
    payload: Partial<OfferRecord>,
    message: string,
  ) => {
    if (!token) return;

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
  };

  const archiveOffer = async (offer: OfferRecord) => {
    if (!token) return;

    setUpdatingOfferId(offer.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.offers.remove(token, offer.id);
      setOffers((current) => current.filter((item) => item.id !== offer.id));
      setOpenActionsOfferId(null);
      setActionMessage(`${offer.name} archived.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to archive offer.",
      );
    } finally {
      setUpdatingOfferId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Offers"
        subtitle="Manage promotional offers and discounts."
        right={
          <button
            onClick={() => router.push("/app/marketing/offers/new")}
            className="btn-primary"
          >
            <Plus className="w-4 h-4" /> Create Offer
          </button>
        }
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Backend offers could not be loaded"
          description={loadError}
          variant="warning"
        />
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
          title="Offer action failed"
          description={actionError}
          variant="error"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Active Offers"
              value={String(activeOffers)}
              icon={Gift}
              color="green"
            />
            <StatCard
              label="Scheduled"
              value={String(scheduledOffers)}
              icon={Calendar}
              color="violet"
            />
            <StatCard
              label="Expired"
              value={String(expiredOffers)}
              icon={AlertTriangle}
              color="amber"
            />
            <StatCard
              label="Redemptions"
              value={String(totalRedemptions)}
              icon={Tag}
              color="blue"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading &&
          Array.from({ length: 3 }, (_, index) => (
            <CardSkeleton key={index} lines={5} />
          ))}
        {!isLoading && offers.map((offer) => (
          <Card key={offer.id} hover>
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center">
                <Gift className="w-5 h-5 text-rose-500" />
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={offer.status} />
                <button
                  onClick={() =>
                    setOpenActionsOfferId((current) =>
                      current === offer.id ? null : offer.id,
                    )
                  }
                  aria-label={`More options for ${offer.name}`}
                  className="rounded-lg p-1.5 text-[#6B7280] hover:bg-[rgba(0,0,0,0.04)]"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </div>
            </div>
            {openActionsOfferId === offer.id && (
              <div className="mb-4 rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] p-2">
                <div className="grid grid-cols-2 gap-2">
                  {(["active", "scheduled", "expired"] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        void updateOffer(
                          offer,
                          { status },
                          `${offer.name} marked as ${status}.`,
                        )
                      }
                      disabled={
                        updatingOfferId === offer.id || offer.status === status
                      }
                      className="rounded-lg px-3 py-2 text-xs font-medium capitalize text-[#5e8a8d] hover:bg-white disabled:opacity-50"
                    >
                      {status}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      void updateOffer(
                        offer,
                        { redemptions: offer.redemptions + 1 },
                        `Recorded a redemption for ${offer.name}.`,
                      )
                    }
                    disabled={updatingOfferId === offer.id}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-[#6E6AE8] hover:bg-[rgba(110,106,232,0.08)] disabled:opacity-50"
                  >
                    Redeem +1
                  </button>
                  <button
                    onClick={() => void archiveOffer(offer)}
                    disabled={updatingOfferId === offer.id}
                    className="rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Archive
                  </button>
                </div>
              </div>
            )}
            <h3 className="font-semibold mb-2 text-[#111111]">{offer.name}</h3>
            <p className="text-2xl font-bold text-[#6E6AE8] mb-3">
              {offer.discount}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-[#6B7280]">
                <Tag className="w-4 h-4" />
                <span>{offer.treatment}</span>
              </div>
              <div className="flex items-center gap-2 text-[#6B7280]">
                <Calendar className="w-4 h-4" />
                <span>{offer.validUntil}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-[rgba(0,0,0,0.06)] flex items-center justify-between">
              <span className="text-sm text-[#6B7280]">
                {offer.redemptions} redemptions
              </span>
              <button
                onClick={() =>
                  router.push(`/app/marketing/offers/new?id=${offer.id}`)
                }
                className="text-sm text-[#6E6AE8] hover:text-[#5A56D4] font-medium transition-colors"
              >
                Edit
              </button>
            </div>
          </Card>
        ))}
        {!isLoading && offers.length === 0 && (
          <Card className="md:col-span-2 lg:col-span-3">
            <p className="text-sm text-[#6B7280]">No offers loaded yet.</p>
          </Card>
        )}
      </div>
    </div>
  );
}
