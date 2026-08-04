const sourceAliases: Record<string, string> = {
  google_ad: "google_ads",
  googleads: "google_ads",
  adwords: "google_ads",
  google_adwords: "google_ads",
  paid_search: "google_ads",
  ppc: "google_ads",
  google_ppc: "google_ads",
  google: "google_ads",
  meta_ads: "meta",
  facebook_ads: "meta",
  facebook: "meta",
  instagram_ads: "meta",
  instagram: "meta",
  paid_social: "meta",
  social_paid: "meta",
  gbp: "google_business_profile",
  gmb: "google_business_profile",
  google_my_business: "google_business_profile",
  organic_search: "seo",
  organic_google: "seo",
  referal: "referral",
  referrals: "referral",
  web: "website",
  site: "website",
  phone: "call_tracking",
  call: "call_tracking",
  calls: "call_tracking",
};

const sourceLabels: Record<string, string> = {
  google_ads: "Google Ads",
  meta: "Meta Ads",
  google_business_profile: "Google Business Profile",
  seo: "SEO",
  referral: "Referral",
  website: "Website",
  call_tracking: "Call tracking",
};

export function normaliseMarketingSource(value: unknown) {
  const compact = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return sourceAliases[compact] || compact;
}

export function marketingSourceLabel(value: unknown) {
  const key = normaliseMarketingSource(value);
  if (!key) return "";

  return (
    sourceLabels[key] ||
    key
      .split("_")
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ")
  );
}
