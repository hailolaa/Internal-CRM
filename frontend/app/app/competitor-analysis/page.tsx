"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Brain, ExternalLink, Trash2 } from "lucide-react";
import { PageHeader, Card } from "@/components/ui";
import { FormField } from "@/components/ui/forms";
import { api } from "@/lib/api-client";
import type {
  AiCompetitorInsightsOutput,
  AiRunRecord,
  CompetitorRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { SEO_STRENGTH_COLOR } from "@/lib/data/competitor-analysis";

const COMPETITOR_INSIGHTS_AGENT_KEY = "competitor_insights";

function isCompetitorInsightsOutput(
  value: unknown,
): value is AiCompetitorInsightsOutput {
  if (!value || typeof value !== "object") return false;
  const output = value as Partial<AiCompetitorInsightsOutput>;
  return Boolean(
    typeof output.summary === "string" &&
      Array.isArray(output.insights) &&
      Array.isArray(output.opportunities),
  );
}

export default function CompetitorAnalysisPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [showAddModal, setShowAddModal] = useState(false);
  const [competitors, setCompetitors] = useState<CompetitorRecord[]>([]);
  const [form, setForm] = useState({
    name: "",
    url: "",
    keyTreatments: "",
    pricePosition: "Mid-range" as CompetitorRecord["pricePosition"],
    offer: "",
    messagingAngle: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const competitorRuns = useMemo(
    () => runs.filter((run) => run.agentKey === COMPETITOR_INSIGHTS_AGENT_KEY),
    [runs],
  );
  const insightsOutput = competitorRuns.find((run) =>
    isCompetitorInsightsOutput(run.output),
  )?.output as AiCompetitorInsightsOutput | undefined;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadCompetitors() {
      setIsLoading(true);
      try {
        const [rows, runRows] = await Promise.all([
          api.competitors.list(authToken),
          api.ai.listRuns(authToken, {
            agentKey: COMPETITOR_INSIGHTS_AGENT_KEY,
          }),
        ]);
        if (!cancelled) {
          setCompetitors(rows);
          setRuns(runRows);
          setStatusMessage(null);
        }
      } catch (error) {
        console.error("Failed to load competitors", error);
        if (!cancelled) {
          setCompetitors([]);
          setRuns([]);
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load live competitor records.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    loadCompetitors();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleCreateCompetitor = async () => {
    if (!token || !form.name.trim() || !form.url.trim()) return;

    const payload = {
      name: form.name,
      url: form.url.replace(/^https?:\/\//, ""),
      keyTreatments: form.keyTreatments
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      pricePosition: form.pricePosition,
      offer: form.offer,
      messagingAngle: form.messagingAngle,
    };

    try {
      const created = await api.competitors.create(token, payload);
      setCompetitors((items) => [
        {
          id: created.id,
          ...payload,
          offer: payload.offer || null,
          messagingAngle: payload.messagingAngle || null,
          adPresence: { google: false, meta: false },
          seoStrength: "Medium",
          rating: 0,
          reviews: 0,
        },
        ...items,
      ]);
      setForm({
        name: "",
        url: "",
        keyTreatments: "",
        pricePosition: "Mid-range",
        offer: "",
        messagingAngle: "",
      });
      setShowAddModal(false);
      setStatusMessage("Competitor added.");
    } catch (error) {
      console.error("Failed to create competitor", error);
      setStatusMessage("Could not add competitor.");
    }
  };

  const handleRemoveCompetitor = async (competitor: CompetitorRecord) => {
    if (!token) return;
    if (!window.confirm(`Remove ${competitor.name}?`)) return;

    try {
      await api.competitors.remove(token, competitor.id);
      setCompetitors((items) =>
        items.filter((item) => item.id !== competitor.id),
      );
      setStatusMessage("Competitor removed.");
    } catch (error) {
      console.error("Failed to remove competitor", error);
      setStatusMessage("Could not remove competitor.");
    }
  };

  const handleGenerateInsights = async () => {
    if (!token || isGenerating) return;

    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const generated = await api.ai.generateCompetitorInsights(token, {
        competitorIds: competitors.map((competitor) => competitor.id),
      });
      setRuns((current) => [
        {
          id: generated.id,
          projectId: null,
          agentName: "Competitor Insights",
          agentKey: generated.agentKey,
          task: `Generated competitor insights for ${competitors.length} competitors`,
          input: null,
          output: generated.output,
          status: generated.status,
          tokens: 0,
          createdAt: generated.createdAt,
        },
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setStatusMessage("Competitor insights generated and saved to AI history.");
    } catch (error) {
      console.error("Failed to generate competitor insights", error);
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Could not generate competitor insights.",
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Competitor Analysis"
        subtitle="Actionable intelligence on competitor offers, ads, and positioning."
        icon={Brain}
        iconColor="text-[#7D8F7A]"
        iconBg="bg-[rgba(125,143,122,0.1)]"
        right={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleGenerateInsights}
              disabled={!token || isGenerating || competitors.length === 0}
              className="btn-secondary disabled:opacity-50"
            >
              <Brain className="w-4 h-4" />
              {isGenerating ? "Generating..." : "Generate Insights"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddModal(!showAddModal)}
              className="btn-primary"
            >
              <Plus className="w-4 h-4" /> Add Competitor
            </button>
          </div>
        }
      />

      {statusMessage && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      {showAddModal && (
        <Card>
          <h3 className="font-semibold mb-4" style={{ color: "#252421" }}>
            Add New Competitor
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              label="Competitor Name"
              value={form.name}
              onChange={(value) => setForm((current) => ({ ...current, name: value }))}
              placeholder="e.g. Skin Clinic London"
            />
            <FormField
              label="Website URL"
              value={form.url}
              onChange={(value) => setForm((current) => ({ ...current, url: value }))}
              placeholder="e.g. skinclinic-london.co.uk"
              type="url"
            />
            <FormField
              label="Key Treatments"
              value={form.keyTreatments}
              onChange={(value) =>
                setForm((current) => ({ ...current, keyTreatments: value }))
              }
              placeholder="e.g. Botox, Lip Filler"
            />
            <FormField
              label="Price Positioning"
              value={form.pricePosition}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  pricePosition: value as CompetitorRecord["pricePosition"],
                }))
              }
              type="select"
              options={[
                { value: "Budget", label: "Budget" },
                { value: "Mid-range", label: "Mid-range" },
                { value: "Premium", label: "Premium" },
              ]}
            />
            <div className="md:col-span-2">
              <FormField
                label="Current Offers / Notes"
                value={form.offer}
                onChange={(value) =>
                  setForm((current) => ({ ...current, offer: value }))
                }
                type="textarea"
                rows={2}
                placeholder="e.g. Running 20% off Botox this month..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => setShowAddModal(false)}
              className="btn-secondary text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleCreateCompetitor}
              className="btn-primary text-sm"
            >
              Save Competitor
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, index) => (
            <Card key={index}>
              <div className="space-y-4">
                <div className="h-12 rounded-xl bg-[rgba(125,143,122,0.08)] animate-pulse" />
                <div className="h-24 rounded-xl bg-[rgba(125,143,122,0.08)] animate-pulse" />
                <div className="h-10 rounded-xl bg-[rgba(125,143,122,0.08)] animate-pulse" />
              </div>
            </Card>
          ))
        ) : competitors.length ? (
          competitors.map((comp) => (
          <Card key={comp.id} hover>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-semibold" style={{ color: "#252421" }}>
                  {comp.name}
                </h3>
                <a
                  href={`https://${comp.url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs flex items-center gap-1 hover:underline"
                  style={{ color: "#7D8F7A" }}
                >
                  {comp.url} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <button
                onClick={() => handleRemoveCompetitor(comp)}
                aria-label={`Remove ${comp.name}`}
                className="p-1.5 rounded-lg hover:bg-[#F7F5F2]"
              >
                <Trash2 className="w-4 h-4 text-[#A8A39B]" />
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <p className="text-xs mb-1" style={{ color: "#A8A39B" }}>
                  Key Treatments
                </p>
                <div className="flex flex-wrap gap-1">
                  {comp.keyTreatments.map((t) => (
                    <span
                      key={t}
                      className="text-xs px-2 py-0.5 rounded"
                      style={{
                        backgroundColor: "#F7F5F2",
                        border: "1px solid #E5DED6",
                        color: "#7A746A",
                      }}
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#A8A39B" }}>
                  Current Offer
                </p>
                  <p className="text-sm" style={{ color: "#252421" }}>
                  {comp.offer || "Not recorded"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs" style={{ color: "#A8A39B" }}>
                    Price Position
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#252421" }}
                  >
                    {comp.pricePosition}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#A8A39B" }}>
                    Messaging
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#252421" }}
                  >
                    {comp.messagingAngle || "Not recorded"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <p className="text-xs" style={{ color: "#A8A39B" }}>
                    Rating
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#252421" }}
                  >
                    ★ {comp.rating}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#A8A39B" }}>
                    Reviews
                  </p>
                  <p
                    className="text-sm font-medium"
                    style={{ color: "#252421" }}
                  >
                    {comp.reviews}
                  </p>
                </div>
                <div>
                  <p className="text-xs" style={{ color: "#A8A39B" }}>
                    SEO
                  </p>
                  <p
                    className={`text-sm font-medium ${SEO_STRENGTH_COLOR[comp.seoStrength] || "text-[#7A746A]"}`}
                  >
                    {comp.seoStrength}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs mb-1" style={{ color: "#A8A39B" }}>
                  Ad Presence
                </p>
                <div className="flex gap-2">
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: comp.adPresence.google
                        ? "rgba(74, 106, 138, 0.08)"
                        : "#F7F5F2",
                      color: comp.adPresence.google ? "#4A6A8A" : "#A8A39B",
                    }}
                  >
                    Google {comp.adPresence.google ? "✓" : "✗"}
                  </span>
                  <span
                    className="text-xs px-2 py-0.5 rounded"
                    style={{
                      backgroundColor: comp.adPresence.meta
                        ? "rgba(125, 143, 122, 0.08)"
                        : "#F7F5F2",
                      color: comp.adPresence.meta ? "#7D8F7A" : "#A8A39B",
                    }}
                  >
                    Meta {comp.adPresence.meta ? "✓" : "✗"}
                  </span>
                </div>
              </div>
            </div>
          </Card>
          ))
        ) : (
          <Card className="lg:col-span-3">
            <div className="py-10 text-center text-sm" style={{ color: "#7A746A" }}>
              No live competitor records found.
            </div>
          </Card>
        )}
      </div>

      <Card>
        <h2
          className="font-semibold mb-4 flex items-center gap-2"
          style={{ color: "#252421" }}
        >
          <Brain className="w-5 h-5 text-[#7D8F7A]" /> AI Growth Insights: How
          to Beat Them This Month
        </h2>
        {insightsOutput ? (
          <div className="space-y-5">
            <p className="text-sm leading-relaxed" style={{ color: "#5F5A52" }}>
              {insightsOutput.summary}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="rounded-xl border border-[#EDE8E2] p-3">
                <p className="text-xs text-[#7A746A]">Competitors</p>
                <p className="text-2xl font-semibold text-[#252421]">
                  {insightsOutput.marketPosition.competitors}
                </p>
              </div>
              <div className="rounded-xl border border-[#EDE8E2] p-3">
                <p className="text-xs text-[#7A746A]">Premium</p>
                <p className="text-2xl font-semibold text-[#252421]">
                  {insightsOutput.marketPosition.premiumCompetitors}
                </p>
              </div>
              <div className="rounded-xl border border-[#EDE8E2] p-3">
                <p className="text-xs text-[#7A746A]">Strong SEO</p>
                <p className="text-2xl font-semibold text-[#252421]">
                  {insightsOutput.marketPosition.strongSeo}
                </p>
              </div>
              <div className="rounded-xl border border-[#EDE8E2] p-3">
                <p className="text-xs text-[#7A746A]">Active offers</p>
                <p className="text-2xl font-semibold text-[#252421]">
                  {insightsOutput.marketPosition.offerCompetitors}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {insightsOutput.opportunities.map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl border border-[#EDE8E2] p-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-[#252421]">{item.title}</p>
                    <span className="text-xs font-medium text-[#7D8F7A]">
                      {item.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-[#7A746A]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {insightsOutput.insights.slice(0, 4).map((item) => (
                <div
                  key={item.competitorId}
                  className="rounded-xl border border-[#EDE8E2] p-3"
                >
                  <p className="font-medium text-[#252421]">{item.name}</p>
                  <p className="mt-1 text-sm text-[#7A746A]">{item.finding}</p>
                  <p className="mt-1 text-sm text-[#5A8A6A]">{item.action}</p>
                </div>
              ))}
            </div>
            {insightsOutput.unavailableActions.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                {insightsOutput.unavailableActions[0].reason}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed" style={{ color: "#7A746A" }}>
            Add competitors, then generate AI insights from the stored competitor
            records.
          </p>
        )}
      </Card>
    </div>
  );
}
