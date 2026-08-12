export const PROPOSAL_CLINIC_TYPE_VARIANT_VERSION = "2026-08-10.v5-approved-assets";

const websiteSourceBase = "/brand/proposal/website-source";
const v5ReferenceBase = "/brand/proposal/v5-reference";
const clinicGrowerOsOverviewImage = `${websiteSourceBase}/clinicgrower-os-video-thumbnail.jpg`;
const clinicGrowerOsProductImage = `${websiteSourceBase}/clinicgrower-os-demo-thumbnail.jpg`;
const clinicGrowerAboutImage = `${websiteSourceBase}/clinicgrower-about.webp`;
const clinicGrowerVideoImage = `${websiteSourceBase}/clinicgrower-videography.webp`;
const aestheticsClinicImage = `${websiteSourceBase}/cosmetic-surgery-marketing-clinic-grower.webp`;
const wellnessClinicImage = `${websiteSourceBase}/hvn-forest-bathing.webp`;

export type ProposalClinicTypeVariantId =
  | "general"
  | "aesthetic_clinic"
  | "dental_clinic"
  | "cosmetic_surgery_clinic"
  | "dermatology_clinic"
  | "hair_transplant_clinic"
  | "wellness_clinic"
  | "private_gp_medical_clinic"
  | "medical_spa";

export type ProposalClinicTypeVariant = {
  id: ProposalClinicTypeVariantId;
  label: string;
  shortLabel: string;
  keywords: string[];
  treatmentExamples: string;
  appointmentLanguage: string;
  firstJourneyEmphasis: string;
  economicUnit: string;
  activeConstraintExample: string;
  responseExample: string;
  clinicalBoundary: string;
  demandQuestion: string;
  progressionQuestion: string;
  postBookingContinuation: string;
  operatingRhythmMorning: string;
  operatingRhythmMonthly: string;
  painPoints: string[];
  patientJourney: string[];
  proofTags: string[];
  heroImageUrl: string | null;
  heroImageAlt: string;
  heroCaption: string;
  heroImageSourceUrl: string | null;
  heroImageApprovalStatus: "approved";
  videoContext: string;
  screenshotCaption: string;
};

export type ProposalClinicTypeImageSlot = "cover" | "journey" | "proof" | "close";

export type ProposalClinicTypeImage = {
  slot: ProposalClinicTypeImageSlot;
  imageId: string;
  url: string;
  alt: string;
  cropPosition: string;
  licence: string;
  provenance: string;
  approvalStatus: "approved";
};

export type ProposalClinicTypeAssetPack = {
  sectorImages: ProposalClinicTypeImage[];
  osScreenshotUrl: string;
  proofBandUrl: string;
  founderVideoThumbnailUrl: string;
  postBookingScreenshotUrl: string;
  implementationImageUrl: string;
};

function v5Asset(directory: string, filename: string) {
  return `${v5ReferenceBase}/${directory}/${filename}`;
}

function v5Image(slot: ProposalClinicTypeImageSlot, id: string, url: string, alt: string): ProposalClinicTypeImage {
  return {
    slot,
    imageId: id,
    url,
    alt,
    cropPosition: "center center",
    licence: "ClinicGrower V5 reference asset pack",
    provenance: "ClinicGrower final V5 proposal PDFs",
    approvalStatus: "approved",
  };
}

function v5Pack(
  directory: string,
  idPrefix: string,
  label: string,
  cover: string,
  journey: string,
  proof: string,
  close: string,
  osScreen: string,
  proofBand: string,
): ProposalClinicTypeAssetPack {
  return {
    sectorImages: [
      v5Image("cover", `${idPrefix}-cover`, v5Asset(directory, cover), `${label} proposal cover image`),
      v5Image("journey", `${idPrefix}-journey`, v5Asset(directory, journey), `${label} clinic systems and journey image`),
      v5Image("proof", `${idPrefix}-proof`, v5Asset(directory, proof), `${label} clinical care and commercial boundary image`),
      v5Image("close", `${idPrefix}-planning`, v5Asset(directory, close), `${label} 90-day planning image`),
    ],
    osScreenshotUrl: v5Asset(directory, osScreen),
    proofBandUrl: v5Asset(directory, proofBand),
    founderVideoThumbnailUrl: v5Asset(directory, "p05-img02-2400x1350.png"),
    postBookingScreenshotUrl: v5Asset(directory, "p09-img01-1440x742.png"),
    implementationImageUrl: v5Asset(directory, close),
  };
}

export const proposalClinicTypeVariants: ProposalClinicTypeVariant[] = [
  {
    id: "general",
    label: "General ClinicGrower",
    shortLabel: "General",
    keywords: ["clinic", "patient", "consultation", "treatment"],
    treatmentExamples: "Primary consultation service\nPriority treatment pathway\nFollow-up or retention service",
    appointmentLanguage: "enquiries, booked consultations and patient follow-up",
    firstJourneyEmphasis: "visibility -> enquiry -> response -> booking -> attended consultation -> recorded value",
    economicUnit: "confirmed patient value unit",
    activeConstraintExample: "The first constraint to verify is whether demand is being lost before it becomes a booked, attended and recorded opportunity.",
    responseExample: "New enquiry received, owner assigned, response time recorded, next action created and outcome tracked.",
    clinicalBoundary: "ClinicGrower OS supports commercial visibility and accountability. Clinical advice, suitability and patient care remain with the clinic team.",
    demandQuestion: "Are the right patients finding the priority services?",
    progressionQuestion: "Do enquiries become attended consultations and recorded value?",
    postBookingContinuation: "response, booking, attendance, follow-up and recorded value",
    operatingRhythmMorning: "Reception and coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews progression, recorded value, capacity and commercial sense.",
    painPoints: [
      "Unclear source-to-booking visibility",
      "Inconsistent enquiry response",
      "Revenue leakage after the lead arrives",
    ],
    patientJourney: ["Visibility", "Enquiry", "Response", "Booking", "Consultation", "Treatment", "Revenue", "Retention"],
    proofTags: ["clinic", "general", "clinicgrower os"],
    heroImageUrl: clinicGrowerOsOverviewImage,
    heroImageAlt: "ClinicGrower OS proposal context for a private clinic",
    heroCaption: "General private clinic growth journey",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/vimeo-1008757315.jpg",
    heroImageApprovalStatus: "approved",
    videoContext: "ClinicGrower OS overview",
    screenshotCaption: "ClinicGrower OS visibility across marketing, enquiries, bookings and revenue where connected.",
  },
  {
    id: "aesthetic_clinic",
    label: "Aesthetic Clinics",
    shortLabel: "Aesthetics",
    keywords: ["aesthetic", "aesthetics", "injectable", "botox", "skin", "laser", "facial"],
    treatmentExamples: "Injectables\nSkin treatments\nLaser treatments\nBody contouring\nConsultation-led treatment plans",
    appointmentLanguage: "consultations, treatment plan starts and repeat aesthetic visits",
    firstJourneyEmphasis: "treatment interest -> response -> consultation -> treatment or repeat",
    economicUnit: "completed injectable treatment",
    activeConstraintExample: "The first constraint to verify is whether high-intent treatment enquiries are being answered, booked and followed up quickly enough.",
    responseExample: "Botox or skin enquiry received, response owner assigned, consultation booking chased and treatment-plan outcome recorded.",
    clinicalBoundary: "ClinicGrower OS can show enquiry, booking and treatment-plan visibility where connected. Treatment suitability, prescribing, consent and clinical decisions remain with the clinic.",
    demandQuestion: "Are the right patients finding the priority treatments?",
    progressionQuestion: "Do treatment enquiries become attended consultations and plans?",
    postBookingContinuation: "consultation, attendance, treatment plan, follow-up, treatment and repeat value",
    operatingRhythmMorning: "Reception and treatment coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews treatment-plan conversion and recorded treatment value, capacity and commercial sense.",
    painPoints: [
      "High-intent treatment enquiries not turning into consultations",
      "Consultation requests without clear treatment-value tracking",
      "Follow-up gaps after quote, consultation or treatment plan discussion",
    ],
    patientJourney: [
      "Treatment search",
      "Phone, WhatsApp or form enquiry",
      "First response",
      "Consultation",
      "Attendance",
      "Treatment plan",
      "Follow-up",
      "Treatment and repeat",
    ],
    proofTags: ["aesthetic", "aesthetics", "skin", "injectable", "laser"],
    heroImageUrl: aestheticsClinicImage,
    heroImageAlt: "Aesthetic clinic treatment enquiry and consultation journey",
    heroCaption: "Aesthetic consultation and treatment-plan visibility",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/cosmetic-surgery-marketing-clinic-grower.webp",
    heroImageApprovalStatus: "approved",
    videoContext: "Aesthetics growth walkthrough",
    screenshotCaption: "ClinicGrower OS view of aesthetic enquiries, consultation outcomes and revenue leakage where connected.",
  },
  {
    id: "dental_clinic",
    label: "Dental Practices",
    shortLabel: "Dental",
    keywords: ["dental", "dentist", "implant", "invisalign", "orthodont", "smile"],
    treatmentExamples: "Dental implants\nInvisalign\nCosmetic dentistry\nSmile makeovers\nPrivate treatment enquiries",
    appointmentLanguage: "new patient enquiries, consultations, treatment-plan acceptance and starts",
    firstJourneyEmphasis: "high-value enquiry -> coordinator -> consultation -> accepted plan",
    economicUnit: "accepted implant case",
    activeConstraintExample: "The first constraint to verify is whether high-value enquiries reach the right coordinator and move through to consultation and accepted plan.",
    responseExample: "Implant or Invisalign enquiry received, coordinator assigned, consultation chased and treatment-plan acceptance recorded.",
    clinicalBoundary: "ClinicGrower OS can show private dental enquiry and treatment-plan progression where connected. Diagnosis, consent and clinical treatment planning remain with the dental team.",
    demandQuestion: "Are implant and aligner patients finding the practice?",
    progressionQuestion: "Do enquiries become attended consultations and accepted cases?",
    postBookingContinuation: "coordinator review, consultation, treatment plan, follow-up and accepted case value",
    operatingRhythmMorning: "Reception and treatment coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews treatment-plan acceptance and accepted case value, capacity and commercial sense.",
    painPoints: [
      "Implant and Invisalign enquiries not tracked through to treatment plans",
      "Phone and form response gaps losing high-value patients",
      "Treatment-value reporting separated from marketing activity",
    ],
    patientJourney: [
      "Treatment search",
      "Patient enquiry",
      "First response",
      "Treatment-coordinator review",
      "Consultation",
      "Treatment plan",
      "Coordinator follow-up",
      "Accepted case",
    ],
    proofTags: ["dental", "dentist", "implant", "invisalign", "smile"],
    heroImageUrl: clinicGrowerOsProductImage,
    heroImageAlt: "Dental clinic high-value treatment enquiry journey",
    heroCaption: "Dental implant, Invisalign and private treatment growth journey",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/vimeo-1026436587.jpg",
    heroImageApprovalStatus: "approved",
    videoContext: "Dental growth walkthrough",
    screenshotCaption: "ClinicGrower OS view of dental enquiries, consultation bookings and treatment-plan revenue where connected.",
  },
  {
    id: "cosmetic_surgery_clinic",
    label: "Cosmetic Surgery Clinics",
    shortLabel: "Cosmetic Surgery",
    keywords: ["cosmetic surgery", "surgery", "surgeon", "procedure", "operation", "patient journey"],
    treatmentExamples: "Surgical consultations\nProcedure enquiries\nPatient suitability reviews\nTreatment pathway progression",
    appointmentLanguage: "surgical enquiries, consultations, suitability reviews and procedure bookings",
    firstJourneyEmphasis: "procedure research -> suitability -> consultation -> deposit",
    economicUnit: "booked rhinoplasty procedure",
    activeConstraintExample: "The first constraint to verify is whether procedure enquiries are qualified, followed up and moved to consultation or deposit without losing trust.",
    responseExample: "Rhinoplasty enquiry received, suitability route confirmed, consultation followed up and deposit or next decision recorded.",
    clinicalBoundary: "ClinicGrower OS can show commercial pathway visibility where connected. Surgical suitability, consent, clinical risk and procedure decisions remain with the surgical team.",
    demandQuestion: "Does procedure research build the trust required to enquire?",
    progressionQuestion: "Do suitable enquiries become attended consultations and deposits?",
    postBookingContinuation: "suitability review, consultation, surgical plan, follow-up, deposit and booked procedure value",
    operatingRhythmMorning: "Patient adviser and surgical coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews deposit conversion and booked procedure value, capacity and commercial sense.",
    painPoints: [
      "Procedure enquiries not qualified or followed up consistently",
      "Consultation and suitability outcomes disconnected from marketing source",
      "Longer decision cycles without clear ownership of follow-up",
    ],
    patientJourney: [
      "Procedure research",
      "Patient enquiry",
      "Suitability review",
      "Consultation",
      "Attendance",
      "Surgical plan",
      "Coordinator follow-up",
      "Deposit and booking",
    ],
    proofTags: ["surgery", "surgeon", "procedure", "cosmetic surgery"],
    heroImageUrl: aestheticsClinicImage,
    heroImageAlt: "Cosmetic surgery patient acquisition and consultation journey",
    heroCaption: "Surgical consultation and decision-cycle visibility",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/cosmetic-surgery-marketing-clinic-grower.webp",
    heroImageApprovalStatus: "approved",
    videoContext: "Cosmetic surgery growth walkthrough",
    screenshotCaption: "ClinicGrower OS view of surgical enquiries, consultations and decision follow-up where connected.",
  },
  {
    id: "dermatology_clinic",
    label: "Dermatology Clinics",
    shortLabel: "Dermatology",
    keywords: ["dermatology", "dermatologist", "skin clinic", "acne", "mole", "eczema", "skin"],
    treatmentExamples: "Dermatology consultations\nSkin checks\nAcne treatment pathways\nMole mapping\nSpecialist skin pathways",
    appointmentLanguage: "skin enquiries, specialist consultations and treatment pathway starts",
    firstJourneyEmphasis: "condition search -> private route -> appointment -> care pathway",
    economicUnit: "attended new-patient appointment",
    activeConstraintExample: "The first constraint to verify is whether condition-led demand is being routed into the right private appointment pathway.",
    responseExample: "Acne, mole or skin-condition enquiry received, appointment route confirmed, attendance tracked and care-pathway follow-up recorded.",
    clinicalBoundary: "ClinicGrower OS can show condition-led enquiry and appointment visibility where connected. Diagnosis, clinical advice and care-pathway decisions remain with the dermatology team.",
    demandQuestion: "Can patients see the relevant private route quickly?",
    progressionQuestion: "Does condition-led demand become an attended appointment?",
    postBookingContinuation: "private appointment, attendance, diagnosis, care pathway and recorded patient value",
    operatingRhythmMorning: "Patient services and clinic coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews care-pathway conversion and recorded patient value, capacity and commercial sense.",
    painPoints: [
      "Specialist skin enquiries not visible through to booked consultation",
      "Website journeys not separating condition-led intent clearly enough",
      "Clinical capacity and follow-up not connected to demand sources",
    ],
    patientJourney: [
      "Condition search",
      "Service page",
      "Patient enquiry",
      "Private appointment",
      "Attendance",
      "Diagnosis",
      "Care pathway",
      "Recorded value",
    ],
    proofTags: ["dermatology", "skin", "acne", "mole", "eczema"],
    heroImageUrl: clinicGrowerOsProductImage,
    heroImageAlt: "Dermatology clinic condition-led enquiry and consultation journey",
    heroCaption: "Dermatology consultation and treatment-pathway visibility",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/vimeo-1026436587.jpg",
    heroImageApprovalStatus: "approved",
    videoContext: "Dermatology growth walkthrough",
    screenshotCaption: "ClinicGrower OS view of skin-condition enquiries, bookings and treatment pathway outcomes where connected.",
  },
  {
    id: "hair_transplant_clinic",
    label: "Hair Transplant Clinics",
    shortLabel: "Hair Transplant",
    keywords: ["hair transplant", "hair restoration", "fue", "hair loss", "transplant"],
    treatmentExamples: "Hair restoration enquiries\nFUE consultations\nPatient suitability reviews\nProcedure planning",
    appointmentLanguage: "hair restoration enquiries, consultations, quotes and procedure starts",
    firstJourneyEmphasis: "research -> nurture -> assessment -> deposit",
    economicUnit: "booked FUE procedure",
    activeConstraintExample: "The first constraint to verify is whether research-stage hair loss enquiries are being nurtured into assessment and deposit.",
    responseExample: "FUE enquiry received, assessment owner assigned, quote follow-up tracked and deposit or next decision recorded.",
    clinicalBoundary: "ClinicGrower OS can show enquiry, assessment and deposit visibility where connected. Hair restoration suitability, clinical advice and procedure planning remain with the clinic.",
    demandQuestion: "Does long-form research build enough authority to enquire?",
    progressionQuestion: "Do suitable candidates become attended assessments and deposits?",
    postBookingContinuation: "assessment, attendance, procedure plan, adviser follow-up, deposit and booked procedure value",
    operatingRhythmMorning: "Patient adviser and procedure coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews deposit conversion and booked procedure value, capacity and commercial sense.",
    painPoints: [
      "Hair loss enquiries not qualified or followed up fast enough",
      "Quote and consultation outcomes separated from source data",
      "Lost opportunity across longer research and decision cycles",
    ],
    patientJourney: [
      "Procedure research",
      "Candidate enquiry",
      "Suitability review",
      "Assessment",
      "Attendance",
      "Procedure plan",
      "Adviser follow-up",
      "Deposit and booking",
    ],
    proofTags: ["hair", "hair transplant", "hair restoration", "fue"],
    heroImageUrl: clinicGrowerOsProductImage,
    heroImageAlt: "Hair transplant clinic enquiry and consultation journey",
    heroCaption: "Hair restoration consultation and procedure-decision visibility",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/vimeo-1026436587.jpg",
    heroImageApprovalStatus: "approved",
    videoContext: "Hair transplant growth walkthrough",
    screenshotCaption: "ClinicGrower OS view of hair restoration enquiries, consultations, quotes and follow-up where connected.",
  },
  {
    id: "wellness_clinic",
    label: "Wellness Clinics",
    shortLabel: "Wellness",
    keywords: ["wellness", "health optimisation", "longevity", "functional", "therapy", "wellbeing"],
    treatmentExamples: "Wellness consultations\nHealth optimisation\nLongevity programmes\nFunctional medicine\nMembership pathways",
    appointmentLanguage: "wellness enquiries, discovery calls, consultations and programme starts",
    firstJourneyEmphasis: "education -> discovery -> enrolment -> renewal",
    economicUnit: "weight-management programme enrolment",
    activeConstraintExample: "The first constraint to verify is whether education-led demand is moving into discovery, enrolment and renewal.",
    responseExample: "Weight-management or longevity enquiry received, discovery call chased, programme recommendation tracked and renewal opportunity recorded.",
    clinicalBoundary: "ClinicGrower OS can show commercial programme visibility where connected. Health advice, prescribing, clinical suitability and programme decisions remain with the clinic.",
    demandQuestion: "Do the right people understand who each programme is for?",
    progressionQuestion: "Does interest become a consultation, enrolment and renewal?",
    postBookingContinuation: "discovery, consultation, recommendation, programme start, renewal and recurring value",
    operatingRhythmMorning: "Client care and programme coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews programme uptake and recurring client value, capacity and commercial sense.",
    painPoints: [
      "Broad wellness demand not separated into clear service pathways",
      "Discovery-call and consultation outcomes not measured by source",
      "Membership or programme follow-up not owned consistently",
    ],
    patientJourney: [
      "Goal or condition",
      "Programme page",
      "Client enquiry",
      "Discovery call",
      "Consultation",
      "Recommendation",
      "Programme start",
      "Renewal",
    ],
    proofTags: ["wellness", "longevity", "health optimisation", "functional", "wellbeing"],
    heroImageUrl: wellnessClinicImage,
    heroImageAlt: "Wellness clinic programme enquiry and consultation journey",
    heroCaption: "Wellness consultation, programme and retention visibility",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/hvn-forest-bathing.webp",
    heroImageApprovalStatus: "approved",
    videoContext: "Wellness growth walkthrough",
    screenshotCaption: "ClinicGrower OS view of wellness enquiries, programme starts and retention opportunities where connected.",
  },
  {
    id: "private_gp_medical_clinic",
    label: "Private GP & Medical Clinics",
    shortLabel: "Private GP",
    keywords: ["private gp", "medical clinic", "doctor", "health check", "gp", "screening"],
    treatmentExamples: "Private GP appointments\nHealth checks\nScreening\nMedical consultations\nRecurring care",
    appointmentLanguage: "patient enquiries, appointments, medical consultations and follow-up care",
    firstJourneyEmphasis: "private access -> booking -> appointment -> attributable value",
    economicUnit: "attended private GP appointment",
    activeConstraintExample: "The first constraint to verify is whether private medical demand is turning into booked and attended appointments with attributable value.",
    responseExample: "Private GP or screening enquiry received, booking route confirmed, appointment attendance tracked and follow-up value recorded.",
    clinicalBoundary: "ClinicGrower OS can show private medical enquiry and appointment visibility where connected. Clinical advice, diagnosis, triage and treatment decisions remain with the medical team.",
    demandQuestion: "Can patients see the right private service and route to book?",
    progressionQuestion: "Does patient need become a confirmed, attended appointment?",
    postBookingContinuation: "confirmation, consultation, test or referral, follow-up and attributable service-line value",
    operatingRhythmMorning: "Patient services and medical secretary sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews available clinician capacity and attributable service-line value, capacity and commercial sense.",
    painPoints: [
      "Private appointment demand not tied clearly to source or capacity",
      "Inbound calls and forms not measured through to attendance",
      "Follow-up and recurring-care opportunities not visible enough",
    ],
    patientJourney: [
      "Service search",
      "Service page",
      "Online booking or patient enquiry",
      "Confirmation",
      "Consultation",
      "Test or referral",
      "Follow-up",
      "Completed service",
    ],
    proofTags: ["private gp", "medical", "doctor", "health check", "screening"],
    heroImageUrl: clinicGrowerOsProductImage,
    heroImageAlt: "Private GP and medical clinic appointment journey",
    heroCaption: "Private medical appointment and follow-up visibility",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/vimeo-1026436587.jpg",
    heroImageApprovalStatus: "approved",
    videoContext: "Private medical growth walkthrough",
    screenshotCaption: "ClinicGrower OS view of private medical enquiries, appointments and follow-up outcomes where connected.",
  },
  {
    id: "medical_spa",
    label: "Medical Spas",
    shortLabel: "Medical Spa",
    keywords: ["medical spa", "medspa", "spa", "aesthetic", "skin", "laser", "wellness"],
    treatmentExamples: "Medical spa consultations\nSkin treatments\nLaser treatments\nInjectables\nPackages and repeat treatment journeys",
    appointmentLanguage: "consultations, package enquiries, treatment bookings and repeat visits",
    firstJourneyEmphasis: "positioning -> treatment page -> plan -> repeat or membership",
    economicUnit: "accepted skin-rejuvenation treatment plan",
    activeConstraintExample: "The first constraint to verify is whether premium treatment enquiries are moving into accepted plans, repeat visits or membership.",
    responseExample: "Skin-rejuvenation enquiry received, consultation booked, plan acceptance followed up and repeat treatment or membership recorded.",
    clinicalBoundary: "ClinicGrower OS can show treatment-plan and repeat-booking visibility where connected. Clinical suitability, consent and care decisions remain with the clinic.",
    demandQuestion: "Is the premium medical-aesthetic offer clear enough to choose?",
    progressionQuestion: "Does treatment interest become a plan, repeat visit or membership?",
    postBookingContinuation: "consultation, attendance, treatment plan, membership or nurture, repeat and recurring value",
    operatingRhythmMorning: "Patient concierge and treatment coordinator sees overdue responses, follow-up and priority actions.",
    operatingRhythmMonthly: "The owner reviews treatment-plan conversion and treatment and recurring value, capacity and commercial sense.",
    painPoints: [
      "Spa and medical-aesthetic enquiries not separated by treatment value",
      "Package and repeat-visit opportunities not tracked consistently",
      "Lead handling and rebooking gaps after first consultation",
    ],
    patientJourney: [
      "Treatment discovery",
      "Treatment page",
      "Patient enquiry",
      "Consultation",
      "Attendance",
      "Treatment plan",
      "Membership or nurture",
      "Repeat value",
    ],
    proofTags: ["medical spa", "medspa", "spa", "aesthetic", "skin", "laser"],
    heroImageUrl: wellnessClinicImage,
    heroImageAlt: "Medical spa treatment enquiry and repeat-booking journey",
    heroCaption: "Medical spa consultation, package and rebooking visibility",
    heroImageSourceUrl: "https://new.clinicgrower.co.uk/assets/hvn-forest-bathing.webp",
    heroImageApprovalStatus: "approved",
    videoContext: "Medical spa growth walkthrough",
    screenshotCaption: "ClinicGrower OS view of medical spa enquiries, treatment bookings and repeat revenue where connected.",
  },
];

const proposalClinicTypeAssetPacks: Record<ProposalClinicTypeVariantId, ProposalClinicTypeAssetPack> = {
  general: {
    sectorImages: [
      v5Image("cover", "general-cover", clinicGrowerOsOverviewImage, "ClinicGrower OS overview"),
      v5Image("journey", "general-journey", clinicGrowerAboutImage, "ClinicGrower team and systems context"),
      v5Image("proof", "general-proof", clinicGrowerVideoImage, "ClinicGrower content and accountability context"),
      v5Image("close", "general-planning", clinicGrowerOsProductImage, "ClinicGrower OS planning example"),
    ],
    osScreenshotUrl: clinicGrowerOsProductImage,
    proofBandUrl: clinicGrowerOsOverviewImage,
    founderVideoThumbnailUrl: clinicGrowerOsOverviewImage,
    postBookingScreenshotUrl: clinicGrowerOsProductImage,
    implementationImageUrl: clinicGrowerOsProductImage,
  },
  aesthetic_clinic: v5Pack(
    "aesthetic_clinics",
    "aesthetic",
    "Aesthetic clinic",
    "p01-img02-1672x941.png",
    "p06-img01-1122x1402.png",
    "p10-img01-1122x1402.png",
    "p13-img01-1672x941.png",
    "p07-img01-1440x662.png",
    "p17-img01-6509x1108.png",
  ),
  dental_clinic: v5Pack(
    "dental_practices",
    "dental",
    "Dental practice",
    "p01-img02-1672x941.png",
    "p06-img01-1009x1559.png",
    "p10-img01-1122x1402.png",
    "p13-img01-1672x941.png",
    "p07-img01-1440x662.png",
    "p17-img01-6509x1108.png",
  ),
  cosmetic_surgery_clinic: v5Pack(
    "cosmetic_surgery_clinics",
    "surgical",
    "Cosmetic surgery clinic",
    "p01-img02-1672x941.png",
    "p06-img01-1122x1402.png",
    "p10-img01-1122x1402.png",
    "p13-img01-1672x941.png",
    "p07-img01-1440x660.png",
    "p17-img01-6509x1108.png",
  ),
  dermatology_clinic: v5Pack(
    "dermatology_clinics",
    "dermatology",
    "Dermatology clinic",
    "p01-img02-1672x941.png",
    "p06-img01-1005x1559.png",
    "p10-img01-1122x1402.png",
    "p13-img01-1672x941.png",
    "p07-img01-1440x662.png",
    "p17-img01-6509x1108.png",
  ),
  hair_transplant_clinic: v5Pack(
    "hair_transplant_clinics",
    "hair-transplant",
    "Hair transplant clinic",
    "p01-img02-1672x941.png",
    "p06-img01-996x1545.png",
    "p10-img01-1122x1402.png",
    "p13-img01-1672x941.png",
    "p07-img01-1440x662.png",
    "p17-img01-6509x1108.png",
  ),
  wellness_clinic: v5Pack(
    "wellness_clinics",
    "wellness",
    "Wellness clinic",
    "p01-img02-1672x941.png",
    "p06-img01-1007x1562.png",
    "p10-img01-1122x1402.png",
    "p13-img01-1672x941.png",
    "p07-img01-1440x662.png",
    "p17-img01-6509x1108.png",
  ),
  private_gp_medical_clinic: v5Pack(
    "private_gp_medical_clinics",
    "private-gp",
    "Private GP and medical clinic",
    "p01-img02-1600x900.png",
    "p06-img01-1120x1738.png",
    "p10-img01-1120x1400.png",
    "p13-img01-1600x900.png",
    "p07-img01-1440x662.png",
    "p17-img01-6509x1108.png",
  ),
  medical_spa: v5Pack(
    "medical_spas",
    "medical-spa",
    "Medical spa",
    "p01-img02-1600x900.png",
    "p06-img01-1120x1738.png",
    "p10-img01-1120x1400.png",
    "p13-img01-1600x900.png",
    "p07-img01-1440x662.png",
    "p17-img01-6509x1108.png",
  ),
};

export function getProposalClinicTypeVariant(value: string | null | undefined) {
  return proposalClinicTypeVariants.find((variant) => variant.id === value) || proposalClinicTypeVariants[0];
}

export function getProposalClinicTypeAssetPack(value: string | null | undefined) {
  const variant = getProposalClinicTypeVariant(value);
  return proposalClinicTypeAssetPacks[variant.id] || proposalClinicTypeAssetPacks.general;
}

export function inferProposalClinicTypeVariant(textValues: Array<string | null | undefined>) {
  const text = textValues.filter(Boolean).join(" ").toLowerCase();
  let best = proposalClinicTypeVariants[0];
  let bestScore = 0;
  for (const variant of proposalClinicTypeVariants.slice(1)) {
    const score = variant.keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      best = variant;
      bestScore = score;
    }
  }
  return best;
}
