import { getProposalClinicTypeAssetPack, getProposalClinicTypeVariant } from "@/lib/proposal-clinic-variants";
import type { ClinicTypeVariant, ProposalV5ClinicTypeId, ProposalV5Image, ProposalV5ImageSlot } from "./proposalV5Types";

export const proposalV5ClinicTypeIds = [
  "general",
  "aesthetic_clinic",
  "dental_clinic",
  "cosmetic_surgery_clinic",
  "dermatology_clinic",
  "hair_transplant_clinic",
  "wellness_clinic",
  "private_gp_medical_clinic",
  "medical_spa",
] as const satisfies readonly ProposalV5ClinicTypeId[];

const proposalV5ClinicTypeAliases: Record<string, ProposalV5ClinicTypeId> = {
  aesthetic_clinics: "aesthetic_clinic",
  aesthetics: "aesthetic_clinic",
  dental_practice: "dental_clinic",
  dental_practices: "dental_clinic",
  cosmetic_surgery: "cosmetic_surgery_clinic",
  cosmetic_surgery_clinics: "cosmetic_surgery_clinic",
  dermatology: "dermatology_clinic",
  dermatology_clinics: "dermatology_clinic",
  hair_transplant: "hair_transplant_clinic",
  hair_transplant_clinics: "hair_transplant_clinic",
  wellness: "wellness_clinic",
  wellness_clinics: "wellness_clinic",
  private_gp_medical: "private_gp_medical_clinic",
  private_gp_medical_clinics: "private_gp_medical_clinic",
  private_gp: "private_gp_medical_clinic",
  medical_spas: "medical_spa",
};

export function normaliseProposalV5ClinicTypeId(value: string | null | undefined): ProposalV5ClinicTypeId {
  const normalized = String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  const matched = proposalV5ClinicTypeIds.find((clinicTypeId) => clinicTypeId === normalized);
  return matched || proposalV5ClinicTypeAliases[normalized] || "general";
}

function toV5Image(image: {
  slot: ProposalV5ImageSlot;
  imageId?: string | null;
  url?: string | null;
  alt?: string | null;
  cropPosition?: string | null;
  licence?: string | null;
  provenance?: string | null;
  approvalStatus?: "approved" | "to_confirm" | null;
}): ProposalV5Image {
  return {
    slot: image.slot,
    imageId: image.imageId || null,
    url: image.url || null,
    alt: image.alt || null,
    cropPosition: image.cropPosition || null,
    licence: image.licence || null,
    provenance: image.provenance || null,
    approvalStatus: image.approvalStatus || null,
  };
}

export function getProposalV5ClinicTypeVariant(value: string | null | undefined): ClinicTypeVariant {
  const clinicTypeId = normaliseProposalV5ClinicTypeId(value);
  const variant = getProposalClinicTypeVariant(clinicTypeId);
  const assetPack = getProposalClinicTypeAssetPack(clinicTypeId);
  const sectorImages = Object.fromEntries(
    assetPack.sectorImages.map((image) => [image.slot, toV5Image(image)]),
  ) as Record<ProposalV5ImageSlot, ProposalV5Image>;

  return {
    id: clinicTypeId,
    label: variant.label,
    shortLabel: variant.shortLabel,
    terminology: {
      patient: "patient",
      enquiry: "enquiry",
      consultation: variant.appointmentLanguage,
      economicUnit: variant.economicUnit,
    },
    journeyStages: variant.patientJourney,
    painExamples: variant.painPoints,
    responseExample: variant.responseExample,
    clinicalBoundary: variant.clinicalBoundary,
    demandQuestion: variant.demandQuestion,
    progressionQuestion: variant.progressionQuestion,
    postBookingContinuation: variant.postBookingContinuation,
    operatingRhythmMorning: variant.operatingRhythmMorning,
    operatingRhythmMonthly: variant.operatingRhythmMonthly,
    proofTags: variant.proofTags,
    assetPack: {
      cover: sectorImages.cover,
      journey: sectorImages.journey,
      proof: sectorImages.proof,
      close: sectorImages.close,
    },
    osScreens: [
      {
        slot: "journey",
        imageId: `${variant.id}-os-screen`,
        url: assetPack.osScreenshotUrl,
        alt: variant.screenshotCaption,
        cropPosition: "center center",
        licence: "ClinicGrower V5 reference asset pack",
        provenance: "ClinicGrower final V5 proposal PDFs",
        approvalStatus: "approved",
      },
    ],
    founderVideoThumbnail: {
      slot: "proof",
      imageId: `${variant.id}-founder-video`,
      url: assetPack.founderVideoThumbnailUrl,
      alt: "Max Sharpe founder video thumbnail",
      cropPosition: "center center",
      licence: "ClinicGrower V5 reference asset pack",
      provenance: "ClinicGrower final V5 proposal PDFs",
      approvalStatus: "approved",
    },
    postBookingScreenshot: {
      slot: "journey",
      imageId: `${variant.id}-post-booking-screen`,
      url: assetPack.postBookingScreenshotUrl,
      alt: `${variant.shortLabel} post-booking pipeline demonstration`,
      cropPosition: "center center",
      licence: "ClinicGrower V5 reference asset pack",
      provenance: "ClinicGrower final V5 proposal PDFs",
      approvalStatus: "approved",
    },
    implementationImage: {
      slot: "close",
      imageId: `${variant.id}-implementation`,
      url: assetPack.implementationImageUrl,
      alt: `${variant.shortLabel} implementation planning image`,
      cropPosition: "center center",
      licence: "ClinicGrower V5 reference asset pack",
      provenance: "ClinicGrower final V5 proposal PDFs",
      approvalStatus: "approved",
    },
  };
}
