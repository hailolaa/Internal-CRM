// ============================================================
// Competitor Analysis — data & config
// ============================================================

import { Target, Eye, Zap } from "lucide-react";

export const COMPETITORS = [
  {
    id: "1",
    name: "Skin Clinic London",
    url: "skinclinic-london.co.uk",
    keyTreatments: ["Botox", "Lip Filler", "Chemical Peel"],
    pricePosition: "Mid-range",
    offer: "Free consultation + 10% off first treatment",
    messagingAngle: "Medical expertise & safety-first",
    adPresence: { google: true, meta: true },
    seoStrength: "Strong",
    rating: 4.7,
    reviews: 234,
  },
  {
    id: "2",
    name: "Glow & Go Aesthetics",
    url: "glowandgo.co.uk",
    keyTreatments: ["Lip Filler", "Dermal Filler", "Skin Boosters"],
    pricePosition: "Premium",
    offer: "Luxury experience, no discounts",
    messagingAngle: "Luxury & exclusivity",
    adPresence: { google: true, meta: true },
    seoStrength: "Medium",
    rating: 4.9,
    reviews: 156,
  },
  {
    id: "3",
    name: "Beauty Bar Clinic",
    url: "beautybarclinic.co.uk",
    keyTreatments: ["Botox", "Lip Filler", "Body Contouring"],
    pricePosition: "Budget",
    offer: "£99 Botox, £199 Lip Filler",
    messagingAngle: "Affordable aesthetics for everyone",
    adPresence: { google: false, meta: true },
    seoStrength: "Weak",
    rating: 4.3,
    reviews: 89,
  },
] as const;

export const AI_INSIGHTS = [
  {
    type: "opportunity" as const,
    title: "Deposit-first positioning",
    detail:
      "Top 3 competitors do not promote deposit-first booking. Opportunity to increase show rate positioning and differentiate on commitment quality.",
  },
  {
    type: "opportunity" as const,
    title: "Skin treatment gap",
    detail:
      "Beauty Bar Clinic and Glow & Go don't promote skin treatments heavily. You can dominate this category with targeted Google Ads.",
  },
  {
    type: "weakness" as const,
    title: "Competitor pricing undercut",
    detail:
      "Beauty Bar Clinic is running £99 Botox ads. Don't compete on price — instead, emphasise practitioner credentials and safety in your ad copy.",
  },
  {
    type: "opportunity" as const,
    title: "SEO gap: 'dermal filler [your area]'",
    detail:
      "No competitor ranks in top 3 for 'dermal filler' + your location. Create a dedicated landing page to capture this traffic.",
  },
  {
    type: "strategy" as const,
    title: "Suggested campaign angle",
    detail:
      "Lead with 'consultation-first' messaging. Position as the clinic that gives honest advice, not hard sells. This differentiates from discount-led competitors.",
  },
] as const;

export const SEO_STRENGTH_COLOR: Record<string, string> = {
  Strong: "text-[#5A8A6A]",
  Medium: "text-[#A07840]",
  Weak: "text-[#8A4A4A]",
};

export const INSIGHT_STYLES: Record<
  string,
  {
    bg: string;
    border: string;
    icon: typeof Target;
    iconColor: string;
    textColor: string;
  }
> = {
  opportunity: {
    bg: "rgba(90, 138, 106, 0.05)",
    border: "rgba(90, 138, 106, 0.2)",
    icon: Target,
    iconColor: "text-[#5A8A6A]",
    textColor: "text-[#5A8A6A]",
  },
  weakness: {
    bg: "rgba(160, 120, 64, 0.05)",
    border: "rgba(160, 120, 64, 0.2)",
    icon: Eye,
    iconColor: "text-[#A07840]",
    textColor: "text-[#A07840]",
  },
  strategy: {
    bg: "rgba(125, 143, 122, 0.05)",
    border: "rgba(125, 143, 122, 0.2)",
    icon: Zap,
    iconColor: "text-[#7D8F7A]",
    textColor: "text-[#7D8F7A]",
  },
};
