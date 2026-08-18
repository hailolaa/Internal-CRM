import type { CSSProperties, ReactElement, ReactNode } from "react";
import type { ProposalV5ClinicTypeId, ProposalV5PageId, ProposalV5ProofAsset, ProposalV5Snapshot } from "../data/proposalV5Types";
import { formatProposalV5Money } from "../data/breakEven";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { safeV19Href, selectedProof } from "./v19PageHelpers";

type Align = "left" | "center" | "right";

type SectorSpec = {
  slug: string;
  label: string;
  exampleClinic: string;
  exampleShort: string;
  exampleOwner: string;
  ownerRole: string;
  proposalId: string;
  priority: string;
  unitName: string;
  price: number;
  cpl: number;
  enquiriesPerPatient: number;
  repeatValue: number;
  repeatLabel: string;
  repeatTimeframe: string;
  coverHeadline: string;
  coverSubhead: string;
  journey: [string, string, string];
  demandPain: string;
  visibilityPain: string;
  decisionPain: string;
  capacityPain: string;
  patientPageNoun: string;
  seoPageLabel: string;
  complianceCopy: string;
  ownerClosure: string;
  stageMap: string[];
  finalLeak: [string, string];
  founderContext: string;
  pageNouns: [string, string, string, string];
  page6Headline: string;
  oneOff: boolean;
};

const W = 595.2755905511812;
const H = 841.8897637795277;
const TANJA_URL = "/brand/proposal/v5-reference/tanja-testimonial.jpg";
const VIMEO_MAX = "https://vimeo.com/1008757315";
const VIMEO_TANJA = "https://vimeo.com/1026436587";
const CASE_STUDY = "https://clinicgrower.co.uk/case-studies/dr-tanja-phillips-clinic/";
const PHONE = "tel:+442070461922";
const QR_FOUNDER = "/brand/proposal/v5-reference/qr-founder-vimeo.png";
const QR_TANJA = "/brand/proposal/v5-reference/qr-tanja-vimeo.png";

const C = {
  dark: "#061D20",
  dark2: "#10373A",
  ink: "#0B292C",
  teal: "#5BCBC5",
  tealDark: "#0F716D",
  mint: "#D9F1EE",
  cream: "#F3EEE5",
  paper: "#FCFBF8",
  white: "#FFFFFF",
  muted: "#526B6D",
  line: "#D2DEDA",
  copper: "#974824",
  copperLight: "#D47C51",
  pale: "#EAF2EF",
};

const stageMaps: Record<string, string[]> = {
  "aesthetic-clinics": ["SOURCE", "ENQUIRY", "CONTACTED", "CONSULT BOOKED", "CONSULT ATTENDED", "PAID START", "PAYMENT RECEIVED", "SESSIONS OWED"],
  "dental-practices": ["SOURCE", "ENQUIRY", "CONTACTED", "ASSESSMENT BOOKED", "ASSESSMENT ATTENDED", "PLAN PRESENTED", "CASE ACCEPTED", "PAID START"],
  "cosmetic-surgery-clinics": ["SOURCE", "ENQUIRY", "CONTACTED", "CONSULT BOOKED", "CONSULT ATTENDED", "REFLECTION", "DEPOSIT PAID", "PROCEDURE BOOKED"],
  "dermatology-clinics": ["SOURCE", "ENQUIRY", "CONTACTED", "ROUTE CONFIRMED", "CONSULT BOOKED", "CONSULT ATTENDED", "CARE COMMENCED", "FOLLOW-UP DUE"],
  "hair-transplant-clinics": ["SOURCE", "CANDIDATE ENQUIRY", "DETAILS COMPLETE", "CONTACTED", "DOCTOR CONSULT", "CONSULT ATTENDED", "DEPOSIT PAID", "PROCEDURE BOOKED"],
  "wellness-clinics": ["SOURCE", "ENQUIRY", "CONTACTED", "ASSESSMENT BOOKED", "ASSESSMENT ATTENDED", "PROGRAMME START", "MONITORING DUE", "ACTIVE PATIENT"],
  "private-gp-medical-clinics": ["SOURCE", "ENQUIRY", "CONTACTED", "ROUTE CONFIRMED", "APPT BOOKED", "ATTENDED", "NEXT STEP DUE", "FOLLOW-UP COMPLETE"],
  "medical-spas": ["SOURCE", "ENQUIRY", "CONTACTED", "CONSULT BOOKED", "CONSULT ATTENDED", "PACKAGE START", "SESSIONS OWED", "MAINTENANCE DUE"],
};

const sectorSpecs: Record<Exclude<ProposalV5ClinicTypeId, "general">, SectorSpec> = {
  aesthetic_clinic: {
    slug: "aesthetic-clinics",
    label: "Aesthetic Clinics",
    exampleClinic: "Alder Aesthetics Clinic",
    exampleShort: "Alder",
    exampleOwner: "Amelia Hart",
    ownerRole: "Founder and Clinical Director",
    proposalId: "CG-AES-0826",
    priority: "Advanced Skin Rejuvenation",
    unitName: "new course patient",
    price: 1440,
    cpl: 30,
    enquiriesPerPatient: 3,
    repeatValue: 1440,
    repeatLabel: "the same course",
    repeatTimeframe: "again within 12 months",
    coverHeadline: "Fill more of the\ntreatment diary.\nKnow what creates\nthe bookings.",
    coverSubhead: "generate qualified local demand for Advanced Skin Rejuvenation, connect search to new paying patients and improve the commercial system month after month",
    journey: ["Call, form\nor WhatsApp", "Contact, book\nand attend", "Paid start and\nnext action"],
    demandPain: "Prospective patients arrive through search, calls, forms and WhatsApp, but demand is not yet connected to paid treatment.",
    visibilityPain: "Marketing is counted at enquiry level while booking, attendance, payment and course completion live elsewhere.",
    decisionPain: "The owner cannot yet see which source, message or follow-up action creates a new paying patient.",
    capacityPain: "Advanced Skin Rejuvenation has room to grow, subject to full diary, practitioner and follow-up validation.",
    patientPageNoun: "treatment page",
    seoPageLabel: "Advanced Skin page",
    complianceCopy: "The clinic approves clinical claims, imagery, credentials and treatment language before publication. No prescription-only medicine promotion, under-18 targeting, unsupported outcome claims or unapproved remarketing is included.",
    ownerClosure: "booked consultations and paid treatment starts",
    stageMap: stageMaps["aesthetic-clinics"],
    finalLeak: ["CONSULTATIONS BUT FEW PAID STARTS", "Surface the commercial gap for the clinic review without entering clinical judgement."],
    founderContext: "For this clinic, the issue is not simply generating more enquiries. It is knowing whether they were contacted, booked, attended and resulted in paid treatment, while the clinic retains clinical control.",
    pageNouns: ["Treatment page", "treatment-led content", "treatment framing", "TREATMENT-LED SEO"],
    page6Headline: "qualified treatment enquiries.",
    oneOff: false,
  },
  dental_clinic: {
    slug: "dental-practices",
    label: "Dental Practices",
    exampleClinic: "Oakfield Dental & Implant Centre",
    exampleShort: "Oakfield",
    exampleOwner: "Dr Sophie Bennett",
    ownerRole: "Principal Dentist",
    proposalId: "CG-DEN-0826",
    priority: "Dental Implants",
    unitName: "new paid implant case",
    price: 3000,
    cpl: 50,
    enquiriesPerPatient: 5,
    repeatValue: 0,
    repeatLabel: "not shown",
    repeatTimeframe: "not shown",
    coverHeadline: "Fill more high-value\ntreatment capacity.\nKnow what creates\nthe starts.",
    coverSubhead: "generate qualified local demand for Dental Implants, connect search to attended assessments and accepted treatment plans, and improve conversion month after month",
    journey: ["Call, form\nor WhatsApp", "Assessment, plan\nand follow-up", "Accepted case and\npaid start"],
    demandPain: "Implant enquiries arrive through search and telephone, but assessment booking and coordinator follow-up are not yet one journey.",
    visibilityPain: "Marketing is counted at enquiry level while assessments, plan acceptance, deposits and treatment starts sit across separate systems or people.",
    decisionPain: "The principal cannot yet see which source, message or coordinator action creates an accepted plan and treatment start.",
    capacityPain: "Implant treatment has room to grow, subject to clinician, treatment-coordinator, surgery and follow-up capacity.",
    patientPageNoun: "implant page",
    seoPageLabel: "Dental Implants page",
    complianceCopy: "The practice approves all clinical claims, clinician credentials, fees, finance wording, imagery and patient information before publication. No guarantee of suitability or outcome, misleading price claim, unsupported comparison or unapproved clinical advice is included.",
    ownerClosure: "attended assessments, accepted plans and paid treatment starts",
    stageMap: stageMaps["dental-practices"],
    finalLeak: ["ASSESSMENTS BUT FEW PAID STARTS", "Surface plan follow-up, finance questions and acceptance gaps without entering clinical judgement."],
    founderContext: "For this practice, the issue is not simply generating more implant enquiries. It is knowing whether they were contacted, assessed, received a plan and became a paid case start, while the clinical team retains control.",
    pageNouns: ["Implant assessment page", "implant-led content", "assessment framing", "IMPLANT-LED SEO"],
    page6Headline: "qualified implant enquiries.",
    oneOff: true,
  },
  cosmetic_surgery_clinic: {
    slug: "cosmetic-surgery-clinics",
    label: "Cosmetic Surgery Clinics",
    exampleClinic: "Harbour Private Surgery",
    exampleShort: "Harbour",
    exampleOwner: "Mr James Holloway",
    ownerRole: "Consultant Plastic Surgeon",
    proposalId: "CG-CSU-0826",
    priority: "Facelift Surgery",
    unitName: "new booked procedure",
    price: 9000,
    cpl: 75,
    enquiriesPerPatient: 8,
    repeatValue: 0,
    repeatLabel: "not shown",
    repeatTimeframe: "not shown",
    coverHeadline: "Turn serious surgical\ninterest into booked\nprocedures - visibly.",
    coverSubhead: "generate considered demand for Facelift Surgery, connect research to surgeon consultations, deposits and booked procedures, and make the long decision journey commercially visible",
    journey: ["Call, form or\nconsult request", "Surgeon consult\nand reflection", "Deposit and\nprocedure booking"],
    demandPain: "Surgical enquiries often have long consideration cycles, variable suitability and repeated questions before a consultation is booked.",
    visibilityPain: "Marketing stops at enquiry while qualification, surgeon consultation, deposit and procedure live across different hand-offs.",
    decisionPain: "The clinic cannot yet see which source and follow-up sequence creates a suitable, deposit-paid surgical patient.",
    capacityPain: "Growth must fit surgeon lists, theatre availability, patient-coordinator capacity and safe pre- and post-operative care.",
    patientPageNoun: "procedure page",
    seoPageLabel: "Facelift Surgery page",
    complianceCopy: "The clinic and consultant approve procedure claims, credentials, risks, fees, finance wording, imagery and patient information before publication. No guaranteed outcome, trivialisation of surgery, pressure selling, inappropriate before-and-after claim or clinical advice is included.",
    ownerClosure: "qualified consultations, paid deposits and booked procedures",
    stageMap: stageMaps["cosmetic-surgery-clinics"],
    finalLeak: ["CONSULTATIONS BUT FEW DEPOSITS", "Review coordinator next actions, unanswered questions and decision timing without pressure or clinical judgement."],
    founderContext: "For this clinic, the issue is not simply generating more procedure enquiries. It is knowing whether they were qualified, consulted, reflected appropriately and became a booked paid procedure, while the clinical team retains control.",
    pageNouns: ["Procedure page", "procedure-led content", "procedure framing", "PROCEDURE-LED SEO"],
    page6Headline: "qualified surgery enquiries.",
    oneOff: true,
  },
  dermatology_clinic: {
    slug: "dermatology-clinics",
    label: "Dermatology Clinics",
    exampleClinic: "Riverside Dermatology Clinic",
    exampleShort: "Riverside",
    exampleOwner: "Dr Maya Shah",
    ownerRole: "Consultant Dermatologist",
    proposalId: "CG-DER-0826",
    priority: "Private Acne Care",
    unitName: "new care-pathway patient",
    price: 840,
    cpl: 35,
    enquiriesPerPatient: 4,
    repeatValue: 560,
    repeatLabel: "further clinic care",
    repeatTimeframe: "within 12 months",
    coverHeadline: "Make it easier for the\nright patients to reach\nthe right pathway.",
    coverSubhead: "generate suitable self-pay demand for Private Acne Care, connect search to attended consultations and commenced care, and protect specialist capacity",
    journey: ["Call or form", "Clinic route and\nconsultation", "Care commenced\n+ follow-up"],
    demandPain: "Patients may not know which service or clinician they need, creating unsuitable enquiries and avoidable reception effort.",
    visibilityPain: "Marketing and referrals are counted at source level while appointment, investigation, procedure and review outcomes sit elsewhere.",
    decisionPain: "The clinical director cannot yet see which demand sources create suitable, attended self-pay pathways without wasting specialist capacity.",
    capacityPain: "Growth must fit consultant clinics, procedure slots, diagnostic access and clinically appropriate follow-up.",
    patientPageNoun: "care-pathway page",
    seoPageLabel: "Private Acne Care page",
    complianceCopy: "The clinic approves all medical claims, consultant credentials, pathway information, imagery and fees before publication. Urgent or emergency symptoms are directed to appropriate care. No diagnosis, guaranteed treatment outcome, prescription-only medicine promotion or clinical advice is delivered through marketing.",
    ownerClosure: "suitable attended consultations and commenced care pathways",
    stageMap: stageMaps["dermatology-clinics"],
    finalLeak: ["CONSULTATIONS BUT FEW CARE STARTS", "Surface administrative hand-offs and recorded next actions without entering clinical judgement."],
    founderContext: "For this clinic, the issue is not simply generating more condition enquiries. It is knowing whether they reached the correct clinic-owned route, attended and commenced care, while the clinical team retains every clinical decision.",
    pageNouns: ["Care-pathway page", "condition-led content", "pathway framing", "CONDITION-LED SEO"],
    page6Headline: "suitable acne-care enquiries.",
    oneOff: false,
  },
  hair_transplant_clinic: {
    slug: "hair-transplant-clinics",
    label: "Hair Transplant Clinics",
    exampleClinic: "Crown Hair Restoration Clinic",
    exampleShort: "Crown",
    exampleOwner: "Dr Adam Rahman",
    ownerRole: "Medical Director",
    proposalId: "CG-HTR-0826",
    priority: "FUE Hair Restoration",
    unitName: "new booked FUE procedure",
    price: 5000,
    cpl: 60,
    enquiriesPerPatient: 7,
    repeatValue: 0,
    repeatLabel: "not shown",
    repeatTimeframe: "not shown",
    coverHeadline: "Turn qualified hair-loss\ninterest into consultations,\ndeposits and procedures.",
    coverSubhead: "generate qualified demand for FUE Hair Restoration, connect research and candidate details to doctor consultations, deposits and booked procedures, and improve a long-consideration journey",
    journey: ["Call, form or\nphoto details", "Doctor consultation\nand reflection", "Deposit and\nprocedure booking"],
    demandPain: "Hair-loss enquiries vary in suitability, readiness, geography and expectation, so raw lead volume can hide poor commercial quality.",
    visibilityPain: "Marketing is counted at enquiry level while photo assessment, consultation, quote, deposit and procedure live across separate hand-offs.",
    decisionPain: "The director cannot yet see which source, message or follow-up sequence creates a suitable deposit-paid transplant patient.",
    capacityPain: "Growth must fit clinical suitability, consultant capacity, procedure days, travel logistics and long-term follow-up.",
    patientPageNoun: "procedure page",
    seoPageLabel: "FUE Hair Restoration page",
    complianceCopy: "The clinic approves all medical claims, clinician credentials, eligibility language, risks, imagery, fees and patient information before publication. No guaranteed graft yield or outcome, misleading before-and-after claim, pressure selling or clinical advice is included.",
    ownerClosure: "qualified doctor consultations, paid deposits and booked procedures",
    stageMap: stageMaps["hair-transplant-clinics"],
    finalLeak: ["DOCTOR CONSULTS BUT FEW DEPOSITS", "Review candidate mix, unanswered questions and next actions without pressure or surgical judgement."],
    founderContext: "For this clinic, the issue is not simply generating more hair enquiries. It is knowing whether candidate details were complete, a doctor consultation happened and a procedure was booked, while the clinic retains every surgical decision.",
    pageNouns: ["FUE procedure page", "doctor-led content", "procedure framing", "PROCEDURE-LED SEO"],
    page6Headline: "qualified FUE enquiries.",
    oneOff: true,
  },
  wellness_clinic: {
    slug: "wellness-clinics",
    label: "Wellness Clinics",
    exampleClinic: "Thrive Health & Wellness Clinic",
    exampleShort: "Thrive",
    exampleOwner: "Dr Lucy Morgan",
    ownerRole: "Clinical Director",
    proposalId: "CG-WEL-0826",
    priority: "Clinician-Led Metabolic Health Programme",
    unitName: "new programme patient",
    price: 720,
    cpl: 30,
    enquiriesPerPatient: 4,
    repeatValue: 1080,
    repeatLabel: "continued programme care",
    repeatTimeframe: "within 12 months",
    coverHeadline: "Turn suitable enquiries\ninto programme starts,\nadherence and renewal.",
    coverSubhead: "generate suitable local demand for the Clinician-Led Metabolic Health Programme, connect search to assessment, programme starts and retention, and improve commercial visibility",
    journey: ["Call, form or\nassessment request", "Assessment and\nenrolment", "Start + retained\ncare"],
    demandPain: "Wellness enquiries vary in suitability, motivation and readiness, so lead volume alone says little about programme value.",
    visibilityPain: "Marketing is counted at enquiry level while assessment, programme acceptance, adherence, review and renewal live elsewhere.",
    decisionPain: "The owner cannot yet see which source and nurture action creates a suitable, paying programme patient who remains engaged.",
    capacityPain: "Growth must fit clinician oversight, assessment capacity, programme delivery, safeguarding and ongoing support.",
    patientPageNoun: "programme page",
    seoPageLabel: "Metabolic Health Programme page",
    complianceCopy: "The clinic approves all health claims, clinician credentials, eligibility language, programme details, fees and imagery. No guaranteed weight loss, unsupported health outcome, prescription-only medicine promotion, diagnosis or personalised clinical advice is included in marketing.",
    ownerClosure: "attended assessments, paid programme starts and retained patients",
    stageMap: stageMaps["wellness-clinics"],
    finalLeak: ["STARTS BUT WEAK RETENTION", "Surface missed non-clinical follow-up and monitoring reminders; clinical care stays with its clinicians."],
    founderContext: "For this clinic, the issue is not generating more medicine requests. It is knowing whether appropriate enquiries attended an assessment, started the programme and remained supported, while clinicians retain all eligibility, prescribing and care decisions.",
    pageNouns: ["Programme page", "education-led content", "programme framing", "PROGRAMME-LED SEO"],
    page6Headline: "suitable programme enquiries.",
    oneOff: false,
  },
  private_gp_medical_clinic: {
    slug: "private-gp-medical-clinics",
    label: "Private GP & Medical Clinics",
    exampleClinic: "Northgate Private Medical Clinic",
    exampleShort: "Northgate",
    exampleOwner: "Dr Hannah Cole",
    ownerRole: "Medical Director",
    proposalId: "CG-MED-0826",
    priority: "Comprehensive Health Assessments",
    unitName: "new health-assessment patient",
    price: 525,
    cpl: 35,
    enquiriesPerPatient: 3,
    repeatValue: 0,
    repeatLabel: "not shown",
    repeatTimeframe: "not shown",
    coverHeadline: "Make private care easier\nto find, access and follow\nthrough.",
    coverSubhead: "generate appropriate local demand for Comprehensive Health Assessments, connect source to correctly routed attendance and completed follow-up, and improve access visibility",
    journey: ["Book, call\nor form", "Correct route and\nattendance", "Follow-up +\nnext step"],
    demandPain: "Patients often arrive with uncertain needs, creating routing work and a risk that urgent or unsuitable enquiries enter the wrong pathway.",
    visibilityPain: "Marketing and referral sources are counted separately from appointments, diagnostics, specialist pathways and follow-up.",
    decisionPain: "The medical director cannot yet see which sources create appropriate attended pathways without overloading clinicians.",
    capacityPain: "Growth must fit GP availability, same-day access, diagnostics, specialist capacity and safe continuity of care.",
    patientPageNoun: "service page",
    seoPageLabel: "Health Assessments page",
    complianceCopy: "The clinic approves all medical claims, clinician credentials, access information, fees, imagery and pathways. Emergency and urgent symptoms are directed to appropriate services. Marketing does not diagnose, replace triage, guarantee availability or provide personalised clinical advice.",
    ownerClosure: "appropriately routed, attended health assessments and completed follow-up",
    stageMap: stageMaps["private-gp-medical-clinics"],
    finalLeak: ["BOOKINGS BUT LOW ATTENDANCE", "Improve reminders, routing, cancellation handling and next actions without entering clinical care."],
    founderContext: "For this clinic, the issue is not simply generating a busier inbox. It is knowing whether patients reached the correct service, attended and completed the next step, while the clinic retains every clinical decision.",
    pageNouns: ["Service page", "service-led content", "route framing", "SERVICE-LED SEO"],
    page6Headline: "suitable health-assessment bookings.",
    oneOff: true,
  },
  medical_spa: {
    slug: "medical-spas",
    label: "Medical Spas",
    exampleClinic: "Elara Medical Spa",
    exampleShort: "Elara",
    exampleOwner: "Dr Olivia Reed",
    ownerRole: "Medical Director",
    proposalId: "CG-MSP-0826",
    priority: "Device-Led Skin Remodelling",
    unitName: "new paid package patient",
    price: 1260,
    cpl: 30,
    enquiriesPerPatient: 3,
    repeatValue: 1260,
    repeatLabel: "the same package",
    repeatTimeframe: "within 12 months",
    coverHeadline: "Fill more practitioner\nand treatment-room capacity.\nSee what creates repeat.",
    coverSubhead: "generate qualified local demand for Device-Led Skin Remodelling, connect search to consultation, package start, course completion and maintenance, and improve retention",
    journey: ["Call, form\nor WhatsApp", "Consultation and\npackage decision", "Complete +\nmaintain"],
    demandPain: "Multi-service demand is easily routed to the wrong treatment or practitioner, weakening enquiry quality and response confidence.",
    visibilityPain: "Marketing is counted at enquiry level while consultation, package acceptance, course completion and repeat treatment live elsewhere.",
    decisionPain: "The owner cannot yet see which source, service route or follow-up action creates a completed, retained package patient.",
    capacityPain: "Growth must fit practitioner, device, room and course-delivery capacity without weakening the patient experience.",
    patientPageNoun: "treatment page",
    seoPageLabel: "Skin Remodelling page",
    complianceCopy: "The medical spa approves clinical claims, practitioner credentials, suitability language, imagery, prices and package wording before publication. No prescription-only medicine promotion, unsupported outcome claim, under-18 targeting or unapproved remarketing is included.",
    ownerClosure: "booked consultations, paid package starts and completed courses",
    stageMap: stageMaps["medical-spas"],
    finalLeak: ["CONSULTATIONS BUT FEW PACKAGES", "Review message, package framing, follow-up and capacity fit without entering clinical judgement."],
    founderContext: "For this medical spa, the issue is not simply generating more cheap enquiries. It is knowing whether they were contacted, consulted, bought a package, completed sessions and returned for maintenance, while the clinic retains clinical control.",
    pageNouns: ["Treatment page", "treatment-led content", "treatment framing", "TREATMENT-LED SEO"],
    page6Headline: "qualified skin-remodelling enquiries.",
    oneOff: false,
  },
};

function pt(value: number) {
  return `${value}pt`;
}

function money(centsOrPounds: number | null | undefined, input: "cents" | "pounds" = "cents") {
  if (typeof centsOrPounds !== "number") return "£______";
  return formatProposalV5Money(input === "pounds" ? centsOrPounds * 100 : centsOrPounds);
}

function selectedPackageName(snapshot: ProposalV5Snapshot) {
  const names: Record<string, string> = {
    "growth-diagnostic": "Growth Diagnostic",
    "lead-concierge": "Lead Concierge",
    "clinic-growth-engine": "Clinic Growth Engine",
    "growth-engine-plus": "Growth Engine Plus",
    "market-leader": "Market Leader",
  };
  return names[String(snapshot.selectedPackage.id || "")] || snapshot.selectedPackage.name || "ClinicGrower growth partnership";
}

function compactDate(value: string | null | undefined) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed).toUpperCase();
}

function clinicTypeKey(value: ProposalV5ClinicTypeId): Exclude<ProposalV5ClinicTypeId, "general"> {
  return value === "general" ? "aesthetic_clinic" : value;
}

function sector(snapshot: ProposalV5Snapshot) {
  return sectorSpecs[clinicTypeKey(snapshot.clinic.clinicType)];
}

function clinicName(snapshot: ProposalV5Snapshot) {
  return snapshot.clinic.name.value || "";
}

function ownerName(snapshot: ProposalV5Snapshot) {
  return snapshot.recipient.name.value || "";
}

function ownerFirst(snapshot: ProposalV5Snapshot, spec: SectorSpec) {
  return ownerName(snapshot).split(/\s+/).filter(Boolean)[0] || spec.exampleOwner.split(/\s+/)[0];
}

function clinicShort(snapshot: ProposalV5Snapshot, spec: SectorSpec) {
  const name = clinicName(snapshot).trim();
  if (!name) return spec.exampleShort;
  const firstChunk = name.split(/[|,&-]/)[0]?.trim() || name;
  const words = firstChunk.split(/\s+/).filter(Boolean);
  return words.slice(0, Math.min(words.length, 2)).join(" ");
}

function priority(snapshot: ProposalV5Snapshot, spec: SectorSpec) {
  return snapshot.clinic.priorityServices.value?.[0] || spec.priority;
}

function unitName(snapshot: ProposalV5Snapshot, spec: SectorSpec) {
  return snapshot.economics.economicUnit.value || spec.unitName;
}

function proofSearchText(asset: ProposalV5ProofAsset | null | undefined) {
  return `${asset?.title || ""} ${asset?.copy || ""} ${asset?.type || ""} ${(asset?.sectorTags || []).join(" ")} ${asset?.source || ""} ${asset?.timeframe || ""}`.toLowerCase();
}

function findProofAsset(proof: ProposalV5ProofAsset[], terms: string[]) {
  const normalizedTerms = terms.map((term) => term.toLowerCase());
  return proof.find((asset) => {
    const haystack = proofSearchText(asset);
    return normalizedTerms.some((term) => haystack.includes(term));
  });
}

function dailyFeeLabel(monthlyFeeCents: number | null | undefined) {
  if (typeof monthlyFeeCents !== "number") return money(null);
  return money(Math.round(monthlyFeeCents / 100 / 30.42), "pounds");
}

function investmentDisplayName(snapshot: ProposalV5Snapshot) {
  const packageName = selectedPackageName(snapshot);
  return packageName === "Clinic Growth Engine" ? "ClinicGrower Managed Growth" : packageName;
}

function initialTermPhrase(months: number) {
  return months === 6 ? "six-month" : `${months}-month`;
}

function initialTermText(months: number) {
  return months === 6 ? "six months" : `${months} months`;
}

function initialTermEndText(months: number) {
  return months === 6 ? "six" : String(months);
}

function evidenceText(value: string | null | undefined, state: string | null | undefined) {
  if (value) return value;
  if (state === "known") return "";
  if (state === "working_diagnosis") return "Working diagnosis";
  if (state === "provisional") return "Provisional";
  return "To confirm";
}

function pageTextStyle({
  x,
  top,
  width,
  size,
  leading,
  color,
  weight = 400,
  align = "left",
  maxLines,
  uppercase,
  style,
}: {
  x: number;
  top: number;
  width: number;
  size: number;
  leading: number;
  color: string;
  weight?: number;
  align?: Align;
  maxLines?: number;
  uppercase?: boolean;
  style?: CSSProperties;
}): CSSProperties {
  return {
    position: "absolute",
    left: pt(x),
    top: pt(top),
    width: pt(width),
    margin: 0,
    color,
    fontFamily: proposalV5Tokens.font.family,
    fontSize: pt(size),
    fontWeight: weight,
    letterSpacing: 0,
    lineHeight: pt(leading),
    textAlign: align,
    textTransform: uppercase ? "uppercase" : undefined,
    overflow: maxLines ? "hidden" : undefined,
    display: maxLines ? "-webkit-box" : undefined,
    WebkitBoxOrient: maxLines ? "vertical" : undefined,
    WebkitLineClamp: maxLines,
    ...style,
  };
}

function T(props: {
  children: ReactNode;
  x: number;
  top: number;
  width: number;
  size: number;
  leading?: number;
  color?: string;
  weight?: number;
  align?: Align;
  maxLines?: number;
  uppercase?: boolean;
  style?: CSSProperties;
}) {
  return (
    <p
      style={pageTextStyle({
        x: props.x,
        top: props.top,
        width: props.width,
        size: props.size,
        leading: props.leading ?? props.size * 1.28,
        color: props.color || C.ink,
        weight: props.weight,
        align: props.align,
        maxLines: props.maxLines,
        uppercase: props.uppercase,
        style: props.style,
      })}
    >
      {props.children}
    </p>
  );
}

function Box({
  x,
  top,
  width,
  height,
  fill,
  stroke,
  radius = 10,
  children,
  style,
}: {
  x: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  stroke?: string;
  radius?: number;
  children?: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: pt(x),
        top: pt(top),
        width: pt(width),
        height: pt(height),
        background: fill,
        border: stroke ? `${pt(0.8)} solid ${stroke}` : undefined,
        borderRadius: pt(radius),
        boxSizing: "border-box",
        overflow: "hidden",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Rule({ x1, x2, top, color = C.line, width = 0.8 }: { x1: number; x2: number; top: number; color?: string; width?: number }) {
  return <div style={{ position: "absolute", left: pt(x1), top: pt(top), width: pt(x2 - x1), height: pt(width), background: color }} />;
}

function ImageCrop({
  url,
  alt,
  x,
  top,
  width,
  height,
  position = "center center",
  brightness,
  contain,
}: {
  url: string | null | undefined;
  alt: string;
  x: number;
  top: number;
  width: number;
  height: number;
  position?: string;
  brightness?: number;
  contain?: boolean;
}) {
  return (
    <figure
      aria-label={alt}
      role="img"
      style={{
        position: "absolute",
        left: pt(x),
        top: pt(top),
        width: pt(width),
        height: pt(height),
        margin: 0,
        backgroundColor: C.pale,
        backgroundImage: url ? `url("${url}")` : undefined,
        backgroundPosition: position,
        backgroundRepeat: "no-repeat",
        backgroundSize: contain ? "contain" : "cover",
        filter: typeof brightness === "number" ? `brightness(${brightness})` : undefined,
        overflow: "hidden",
      }}
    />
  );
}

function QrAsset({
  url,
  label,
  x,
  top,
  size,
}: {
  url: string;
  label: string;
  x: number;
  top: number;
  size: number;
}) {
  return (
    <span
      aria-label={label}
      role="img"
      style={{
        position: "absolute",
        left: pt(x),
        top: pt(top),
        width: pt(size),
        height: pt(size),
        display: "block",
        backgroundImage: `url("${url}")`,
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        backgroundSize: "100% 100%",
      }}
    />
  );
}

function Wordmark({ x = 48, top = 31, dark = false }: { x?: number; top?: number; dark?: boolean }) {
  return (
    <div style={{ position: "absolute", left: pt(x), top: pt(top), display: "flex", alignItems: "baseline", fontSize: pt(9), fontWeight: 900, lineHeight: 1 }}>
      <span style={{ color: dark ? C.teal : C.tealDark }}>CLINIC</span>
      <span style={{ color: dark ? C.white : C.ink }}>GROWER</span>
    </div>
  );
}

function Header({ section, dark = false }: { section: string; dark?: boolean }) {
  return (
    <>
      <Wordmark dark={dark} />
      <T x={348} top={31} width={199} size={7.6} leading={9.5} weight={800} color={dark ? "#91AAA9" : C.muted} align="right" uppercase maxLines={1}>
        {section}
      </T>
    </>
  );
}

function Footer({ snapshot, page, dark = false }: { snapshot: ProposalV5Snapshot; page: number; dark?: boolean }) {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const color = dark ? "#8EA7A6" : C.muted;
  return (
    <footer style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      <Rule x1={49} x2={543} top={810} color={dark ? "#294B4E" : C.line} width={0.65} />
      <T x={49} top={819} width={360} size={7.3} leading={9.1} weight={800} color={color} uppercase maxLines={1}>
        {short} | Private & Confidential
      </T>
      <T x={516} top={819} width={27} size={7.4} leading={9.2} weight={800} color={color} align="right" maxLines={1}>
        {String(page).padStart(2, "0")}
      </T>
    </footer>
  );
}

function Page({
  id,
  page,
  background,
  dark = false,
  section,
  showHeader = true,
  showFooter = true,
  snapshot,
  children,
}: {
  id: ProposalV5PageId;
  page: number;
  background: string;
  dark?: boolean;
  section?: string;
  showHeader?: boolean;
  showFooter?: boolean;
  snapshot: ProposalV5Snapshot;
  children: ReactNode;
}) {
  return (
    <section
      aria-label={`${id} page ${page}`}
      data-v5-page-id={id}
      data-v5-page-number={page}
      data-v5-page-theme={dark ? "dark" : "light"}
      data-v19-reference-page
      style={{
        width: "210mm",
        height: "297mm",
        maxHeight: "297mm",
        position: "relative",
        overflow: "hidden",
        boxSizing: "border-box",
        background,
        color: dark ? C.white : C.ink,
        fontFamily: proposalV5Tokens.font.family,
        pageBreakAfter: "always",
        breakAfter: "page",
      }}
    >
      {showHeader && section ? <Header section={section} dark={dark} /> : null}
      {children}
      {showFooter ? <Footer snapshot={snapshot} page={page} dark={dark} /> : null}
    </section>
  );
}

function DotBullet({ x, top, dark = false }: { x: number; top: number; dark?: boolean }) {
  return <div style={{ position: "absolute", left: pt(x), top: pt(top), width: pt(5), height: pt(5), borderRadius: "50%", background: dark ? C.teal : C.tealDark }} />;
}

function Bullet({
  children,
  x,
  top,
  width,
  dark = false,
  size = 9,
  maxLines = 4,
}: {
  children: ReactNode;
  x: number;
  top: number;
  width: number;
  dark?: boolean;
  size?: number;
  maxLines?: number;
}) {
  return (
    <>
      <DotBullet x={x + 1} top={top + 4} dark={dark} />
      <T x={x + 17} top={top} width={width - 17} size={size} leading={size * 1.37} color={dark ? "#D1E0DE" : C.muted} maxLines={maxLines}>
        {children}
      </T>
    </>
  );
}

function Check({ x, top, color = C.tealDark }: { x: number; top: number; color?: string }) {
  return (
    <div
      aria-hidden
      style={{
        position: "absolute",
        left: pt(x),
        top: pt(top),
        width: pt(11),
        height: pt(9),
        borderLeft: `${pt(1.8)} solid ${color}`,
        borderBottom: `${pt(1.8)} solid ${color}`,
        transform: "rotate(-45deg)",
      }}
    />
  );
}

function Arrow({ x1, x2, top, color = C.tealDark }: { x1: number; x2: number; top: number; color?: string }) {
  return (
    <>
      <Rule x1={x1} x2={x2 - 7} top={top} color={color} width={1.4} />
      <div
        style={{
          position: "absolute",
          left: pt(x2 - 9),
          top: pt(top - 4),
          width: 0,
          height: 0,
          borderTop: `${pt(4)} solid transparent`,
          borderBottom: `${pt(4)} solid transparent`,
          borderLeft: `${pt(8)} solid ${color}`,
        }}
      />
    </>
  );
}

function Button({
  href,
  label,
  x,
  top,
  width,
  height,
  fill,
  color,
  stroke,
  size = 9.2,
}: {
  href: string;
  label: string;
  x: number;
  top: number;
  width: number;
  height: number;
  fill: string;
  color: string;
  stroke?: string;
  size?: number;
}) {
  return (
    <a
      href={href}
      style={{
        position: "absolute",
        left: pt(x),
        top: pt(top),
        width: pt(width),
        height: pt(height),
        display: "grid",
        placeItems: "center",
        boxSizing: "border-box",
        background: fill,
        border: stroke ? `${pt(0.8)} solid ${stroke}` : undefined,
        borderRadius: pt(7),
        color,
        fontSize: pt(size),
        fontWeight: 900,
        lineHeight: 1.1,
        textAlign: "center",
        textDecoration: "none",
        textTransform: "uppercase",
        padding: "0 15pt",
      }}
    >
      {label}
    </a>
  );
}

function PlayButton({ href, label, displayUrl, x, top, width, dark = true }: { href: string; label: string; displayUrl: string; x: number; top: number; width: number; dark?: boolean }) {
  const fill = dark ? C.teal : C.dark;
  const color = dark ? C.dark : C.white;
  return (
    <>
      <Button href={href} label={label} x={x} top={top} width={width} height={45} fill={fill} color={color} size={8.5} />
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: pt(x + 14),
          top: pt(top + 14),
          width: pt(17),
          height: pt(17),
          borderRadius: "50%",
          background: color,
        }}
      />
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: pt(x + 20),
          top: pt(top + 18.5),
          width: 0,
          height: 0,
          borderTop: `${pt(4)} solid transparent`,
          borderBottom: `${pt(4)} solid transparent`,
          borderLeft: `${pt(7)} solid ${fill}`,
        }}
      />
      <T x={x} top={top + 53} width={width} size={7.6} leading={9.5} weight={800} color={C.tealDark} maxLines={1}>
        {displayUrl}
      </T>
    </>
  );
}

function required(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  return [
    ...(!snapshot?.proposal?.reference ? ["proposal.reference"] : []),
    ...(!snapshot?.clinic?.name?.value ? ["clinic.name"] : []),
    ...(!snapshot?.clinic?.location?.value ? ["clinic.location"] : []),
    ...(!snapshot?.recipient?.name?.value ? ["recipient.name"] : []),
    ...(!snapshot?.clinic?.priorityServices?.value?.length ? ["clinic.priorityServices"] : []),
    ...(!snapshot?.selectedPackage?.name ? ["selectedPackage.name"] : []),
    ...(typeof snapshot?.commercial?.monthlyFeeCents !== "number" ? ["commercial.monthlyFeeCents"] : []),
    ...(typeof snapshot?.commercial?.setupFeeCents !== "number" ? ["commercial.setupFeeCents"] : []),
    ...(!snapshot?.commercial?.expiresAt ? ["commercial.expiresAt"] : []),
  ];
}

export function getV19ReferenceMissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  return required(snapshot);
}

export function assertV19ReferenceReady(name: string, snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing = getV19ReferenceMissingFields(snapshot);
  if (missing.length) throw new Error(`${name} is missing required snapshot data: ${missing.join(", ")}`);
}

function page1(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const clinic = clinicName(snapshot);
  const owner = ownerName(snapshot);
  const service = priority(snapshot, spec);
  const preparedDate = compactDate(snapshot.lifecycle.issuedAt || snapshot.lifecycle.createdAt || snapshot.generatedAt);
  const validTo = compactDate(snapshot.lifecycle.expiresAt || snapshot.commercial.expiresAt);
  const cover = snapshot.assets.sectorImages.cover;
  return (
    <Page id="V5Page01Cover" page={1} background={C.dark} dark snapshot={snapshot} showHeader={false} showFooter={false}>
      <ImageCrop url={cover.url} alt={cover.alt || `${spec.label} cover image`} x={0} top={0} width={W} height={H} position="62% center" brightness={0.96} />
      <Box x={0} top={0} width={368} height={H} fill={C.dark} radius={0} style={{ opacity: 0.98 }} />
      <Box x={368} top={0} width={60} height={H} fill={C.dark} radius={0} style={{ opacity: 0.76 }} />
      <Box x={428} top={0} width={W - 428} height={H} fill={C.dark} radius={0} style={{ opacity: 0.15 }} />
      <Wordmark x={49} top={40} dark />
      <T x={49} top={91} width={285} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>
        {short} growth partnership
      </T>
      <Rule x1={49} x2={171} top={139} color={C.teal} width={2.3} />
      <T x={49} top={157} width={298} size={29} leading={31.03} weight={900} color={C.white} maxLines={6}>
        {spec.coverHeadline.replace(spec.priority, service)}
      </T>
      <T x={49} top={375} width={287} size={10.2} leading={14.4} color="#D8E6E4" maxLines={7}>
        {`${short}'s six-month growth partnership to ${spec.coverSubhead.replace(spec.priority, service)}.`}
      </T>
      <T x={49} top={500} width={286} size={7.8} leading={10} weight={900} color={C.teal} uppercase maxLines={2}>
        One location | One priority journey | One accountable team
      </T>
      <Rule x1={49} x2={330} top={548} color="#315457" width={0.8} />
      <T x={49} top={573} width={150} size={7.7} leading={9.6} weight={900} color={C.teal} uppercase maxLines={1}>
        Prepared for
      </T>
      <T x={49} top={606} width={282} size={17} leading={21} weight={900} color={C.white} maxLines={2}>
        {clinic}
      </T>
      <T x={49} top={651} width={280} size={9} leading={11.8} color="#C2D4D2" maxLines={2}>
        {owner} | {snapshot.clinic.location.value || spec.ownerRole}
      </T>
      <Box x={397} top={554} width={150} height={201} fill={C.dark} radius={8} style={{ opacity: 0.88 }} />
      <T x={418} top={578} width={108} size={7.5} leading={9.3} weight={900} color={C.teal} uppercase maxLines={1}>
        The focus
      </T>
      <T x={418} top={616} width={108} size={12.6} leading={16} weight={900} color={C.white} maxLines={3}>
        {service}
      </T>
      <Rule x1={418} x2={526} top={682} color="#3A5D60" width={0.8} />
      <T x={418} top={702} width={108} size={9.4} leading={11.8} weight={900} color={C.white} uppercase maxLines={1}>
        6 months
      </T>
      <T x={418} top={735} width={108} size={6.8} leading={8.5} weight={900} color={C.teal} uppercase maxLines={2}>
        Build / Prove / Compound
      </T>
      <T x={49} top={771} width={465} size={7.2} leading={9} weight={900} color={C.teal} uppercase maxLines={1}>
        {spec.label} | Private client proposal
      </T>
      <T x={49} top={799} width={370} size={7.5} leading={9.3} weight={900} color="#AFC3C1" uppercase maxLines={1}>
        {snapshot.proposal.reference} | Prepared {preparedDate} | Valid to {validTo}
      </T>
    </Page>
  );
}

function page2(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const owner = ownerFirst(snapshot, spec);
  const service = priority(snapshot, spec);
  const prescription = spec.slug === "wellness-clinics" ? "the Metabolic Health Programme" : spec.slug === "private-gp-medical-clinics" ? "Health Assessments" : service;
  const diagnosis = [
    ["CAPACITY", evidenceText(snapshot.discovery.whyNow.value, snapshot.discovery.whyNow.state) || spec.capacityPain],
    ["DEMAND", spec.demandPain.replace(spec.priority, service)],
    ["VISIBILITY", spec.visibilityPain],
    ["DECISION", spec.decisionPain],
  ];
  return (
    <Page id="V5Page02Recommendation" page={2} background={C.cream} snapshot={snapshot} section="The recommendation">
      <T x={49} top={88} width={250} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>
        The partnership in one page
      </T>
      <T x={49} top={124} width={492} size={27} leading={28.9} weight={900} color={C.dark} maxLines={5}>
        {`${owner}, see what leads to ${spec.ownerClosure} for ${short}.`}
      </T>
      <T x={49} top={267} width={190} size={8} leading={10} weight={900} color={C.copper} uppercase maxLines={1}>
        Working diagnosis
      </T>
      {diagnosis.map(([label, body], index) => {
        const top = 307 + index * 67;
        return (
          <div key={label}>
            <T x={49} top={top} width={76} size={7.5} leading={9.3} weight={900} color={C.tealDark} uppercase maxLines={1}>
              {label}
            </T>
            <T x={130} top={top - 1} width={172} size={9.1} leading={12.5} color={C.dark} maxLines={4}>
              {body}
            </T>
            {index < 3 ? <Rule x1={49} x2={302} top={top + 50} color={C.line} width={0.7} /> : null}
          </div>
        );
      })}
      <Box x={326} top={267} width={217} height={302} fill={C.dark} radius={16} />
      <T x={348} top={291} width={170} size={7.8} leading={9.7} weight={900} color={C.teal} uppercase maxLines={1}>
        The prescription
      </T>
      <T x={348} top={330} width={168} size={18.5} leading={23} weight={900} color={C.white} maxLines={5}>
        {`Make ${prescription} one connected patient journey.`}
      </T>
      <T x={348} top={444} width={168} size={9} leading={12.4} color="#C8D9D7" maxLines={10}>
        Start with one priority journey and improve it through three phases. Build the measurement, patient-handling and demand foundation. Optimise paid search, SEO, Google Business Profile and conversion against attended and paid-outcome evidence. Scale only when capacity and the complete economics support it.
      </T>
      <T x={49} top={610} width={160} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>
        Four outcomes
      </T>
      {[
        ["01", "BE FOUND", `Capture people already searching locally for ${service}.`],
        ["02", "BE CHOSEN", "Give the right patient a credible reason to take the next step."],
        ["03", "BE FOLLOWED UP", "Make every non-clinical next action visible and owned."],
        ["04", "SEE PAID OUTCOMES", `Connect marketing to ${spec.ownerClosure}.`],
      ].map(([num, label, body], index) => {
        const x = 49 + index * 126;
        return (
          <div key={num}>
            {index ? <div style={{ position: "absolute", left: pt(x - 13), top: pt(640), width: pt(0.7), height: pt(95), background: C.line }} /> : null}
            <T x={x} top={640} width={26} size={7.5} leading={9.3} weight={900} color={C.tealDark} maxLines={1}>
              {num}
            </T>
            <T x={x} top={668} width={104} size={8} leading={10} weight={900} color={C.dark} uppercase maxLines={2}>
              {label}
            </T>
            <T x={x} top={702} width={104} size={8.2} leading={10.8} color={C.muted} maxLines={5}>
              {body}
            </T>
          </div>
        );
      })}
    </Page>
  );
}

function page3(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const contribution = snapshot.economics.contribution.value;
  const mediaSpend = snapshot.economics.selectedMediaSpend.value;
  const monthlyFee = snapshot.commercial.monthlyFeeCents;
  const relevantSpend = (typeof monthlyFee === "number" ? monthlyFee : 0) + (typeof mediaSpend === "number" ? mediaSpend : 0);
  const breakEven = contribution && relevantSpend ? Math.ceil(relevantSpend / contribution) : snapshot.economics.recurringBreakEvenUnits;
  const unit = unitName(snapshot, spec);
  const assumedMediaPerPatient = typeof contribution === "number" && typeof breakEven === "number" && breakEven > 0 ? Math.round((mediaSpend || 0) / breakEven) : spec.cpl * spec.enquiriesPerPatient * 100;
  const ratio = typeof contribution === "number" && assumedMediaPerPatient ? `${Math.max(1, Math.round(contribution / assumedMediaPerPatient))}:1` : "to confirm";
  return (
    <Page id="V5Page03GoogleMediaRoas" page={3} background={C.dark} dark snapshot={snapshot} section="Patient value">
      <T x={49} top={88} width={465} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>
        {`Illustrative media ROAS | to be validated against ${short}'s data`}
      </T>
      <T x={49} top={123} width={488} size={24} leading={25.7} weight={900} color={C.white} maxLines={4}>
        {`If ${money(assumedMediaPerPatient)} of Google media creates one ${money(contribution)} ${unit}, initial-value ROAS is ${ratio}.`}
      </T>
      <T x={49} top={213} width={488} size={9.7} leading={12.9} color="#D2E0DE" maxLines={4}>
        {`This is a simple gross-revenue-to-Google-spend example. It is not profit or return on the full ClinicGrower service. Mission Control will replace every assumption with ${short}'s actual results.`}
      </T>
      <Box x={49} top={268} width={494} height={119} fill={C.paper} radius={10} />
      <T x={70} top={286} width={390} size={9.2} leading={11.5} weight={900} color={C.tealDark} uppercase maxLines={1}>
        1 | Assumed Google media per new paying patient
      </T>
      <T x={70} top={317} width={82} size={25} leading={30} weight={900} color={C.dark} maxLines={1}>
        {money(spec.cpl, "pounds")}
      </T>
      <T x={157} top={328} width={148} size={8.6} leading={10.8} weight={900} color={C.muted} uppercase maxLines={2}>
        Assumed cost per enquiry
      </T>
      <T x={327} top={317} width={65} size={25} leading={30} weight={900} color={C.dark} maxLines={1}>
        x {spec.enquiriesPerPatient}
      </T>
      <T x={395} top={322} width={126} size={8.4} leading={10.5} weight={900} color={C.muted} uppercase maxLines={3}>
        Enquiries per new paying patient
      </T>
      <T x={70} top={359} width={448} size={11.2} leading={14} weight={900} color={C.tealDark} uppercase maxLines={1}>
        {money(spec.cpl, "pounds")} x {spec.enquiriesPerPatient} = {money(spec.cpl * spec.enquiriesPerPatient, "pounds")} Google media per paying patient
      </T>
      <Box x={49} top={403} width={494} height={112} fill={C.mint} radius={8} />
      <T x={70} top={421} width={320} size={9.2} leading={11.5} weight={900} color={C.tealDark} uppercase maxLines={1}>
        2 | Initial patient-value media ROAS
      </T>
      <T x={70} top={450} width={285} size={22} leading={27} weight={900} color={C.dark} maxLines={1}>
        {money(contribution)} / {money(spec.cpl * spec.enquiriesPerPatient, "pounds")} = {ratio}
      </T>
      <T x={365} top={459} width={156} size={8.4} leading={10.6} weight={900} color={C.tealDark} uppercase maxLines={3}>
        Gross revenue ROAS on Google media only
      </T>
      <T x={70} top={488} width={448} size={9.3} leading={11.8} color={C.muted} maxLines={2}>
        In this example, every £1 of Google media is associated with the recorded initial {serviceOrPriority(snapshot, spec)} patient value.
      </T>
      <Box x={49} top={531} width={494} height={142} fill={C.paper} radius={8} />
      {spec.oneOff ? (
        <>
          <T x={70} top={549} width={448} size={8.8} leading={11} weight={900} color={C.tealDark} uppercase maxLines={1}>
            3 | A conservative initial-purchase view
          </T>
          <T x={70} top={580} width={390} size={18.5} leading={22.5} weight={900} color={C.dark} uppercase maxLines={2}>
            No repeat or referral value included
          </T>
          <T x={70} top={620} width={448} size={10.5} leading={13.4} weight={900} color={C.tealDark} maxLines={2}>
            The {ratio} example uses only the initial collected {serviceOrPriority(snapshot, spec)} value.
          </T>
          <T x={70} top={649} width={448} size={8.9} leading={11.3} color={C.muted} maxLines={2}>
            Any later care, referral or retained-patient value must be measured from the clinic&apos;s own collected data and any further acquisition or retention spend.
          </T>
        </>
      ) : (
        <>
          <T x={70} top={549} width={448} size={8.8} leading={11} weight={900} color={C.tealDark} uppercase maxLines={1}>
            3 | If the same patient buys {spec.repeatLabel} {spec.repeatTimeframe}
          </T>
          <T x={70} top={578} width={300} size={18.5} leading={22.5} weight={900} color={C.dark} maxLines={1}>
            {money(contribution)} + {money(spec.repeatValue, "pounds")} = {money((contribution || 0) + spec.repeatValue * 100)}
          </T>
          <T x={374} top={583} width={145} size={8.2} leading={10.3} weight={900} color={C.muted} uppercase maxLines={2}>
            Possible 12-month collected patient value
          </T>
          <T x={70} top={649} width={448} size={8.9} leading={11.3} color={C.muted} maxLines={2}>
            This assumes the stated further purchase and no second paid-media acquisition. Further care is possible, not promised.
          </T>
        </>
      )}
      <Box x={49} top={689} width={494} height={67} fill={C.dark2} stroke="#31575A" radius={8} />
      <T x={70} top={704} width={240} size={9} leading={11.2} weight={900} color={C.teal} uppercase maxLines={1}>
        So, will {short} make money?
      </T>
      <T x={70} top={727} width={448} size={8.8} leading={11.2} color={C.white} maxLines={2}>
        Potentially - if real enquiry cost, conversion, patient value and delivery costs support it. ClinicGrower measures the complete economics rather than claiming success from ROAS alone.
      </T>
      <T x={49} top={773} width={494} size={7.6} leading={9.4} weight={900} color={C.copperLight} align="center" maxLines={4}>
        Illustrative only, not a forecast or guarantee. The values shown are gross collected clinic revenue and Google media only. They do not deduct ClinicGrower fees, setup, taxes, refunds, delivery, finance or card fees, staff, overheads or retention cost.
      </T>
    </Page>
  );
}

function serviceOrPriority(snapshot: ProposalV5Snapshot, spec: SectorSpec) {
  return priority(snapshot, spec) || spec.priority;
}

function page4TitleLayout(title: string) {
  if (title.length > 110) {
    return {
      size: 24,
      leading: 25.7,
      maxLines: 5,
      bodyTop: 262,
      journeyTop: 332,
      benefitsLabelTop: 520,
      benefitTop: 561,
      finalBoxTop: 724,
      finalTextTop: 742,
    };
  }
  if (title.length > 86) {
    return {
      size: 26,
      leading: 27.8,
      maxLines: 4,
      bodyTop: 250,
      journeyTop: 318,
      benefitsLabelTop: 504,
      benefitTop: 545,
      finalBoxTop: 706,
      finalTextTop: 724,
    };
  }
  return {
    size: 30,
    leading: 32.1,
    maxLines: 4,
    bodyTop: 234,
    journeyTop: 318,
    benefitsLabelTop: 504,
    benefitTop: 545,
    finalBoxTop: 706,
    finalTextTop: 724,
  };
}

function page4(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const owner = ownerFirst(snapshot, spec);
  const service = priority(snapshot, spec);
  const headline = `ClinicGrower connects ${short}'s whole commercial route, not only the advertising.`;
  const layout = page4TitleLayout(headline);
  const nodes = [
    ["ATTRACT", "Google Ads\nSEO + GBP"],
    ["CONVERT", `${spec.pageNouns[0]}\n+ CRO`],
    ["ENQUIRE", spec.journey[0]],
    ["PROGRESS", spec.journey[1]],
    ["DECIDE", spec.journey[2]],
  ];
  return (
    <Page id="V5Page04GrowthEngine" page={4} background={C.paper} snapshot={snapshot} section="The complete growth engine">
      <T x={49} top={88} width={300} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>
        One team across the commercial route
      </T>
      <T x={49} top={124} width={480} size={layout.size} leading={layout.leading} weight={900} color={C.dark} maxLines={layout.maxLines}>
        {headline}
      </T>
      <T x={49} top={layout.bodyTop} width={486} size={9.5} leading={13} weight={800} color={C.muted} maxLines={3}>
        {`We connect ${short}'s route from first search to ${spec.ownerClosure}. ${owner} and the team keep the patient relationship and every clinical decision.`}
      </T>
      {nodes.map(([label, body], index) => {
        const x = 49 + index * 101;
        const top = layout.journeyTop;
        const fill = index === 0 || index === 4 ? C.dark : index === 1 || index === 3 ? C.mint : C.cream;
        const dark = index === 0 || index === 4;
        return (
          <div key={label}>
            <Box x={x} top={top} width={90} height={140} fill={fill} radius={8} />
            <T x={x + 14} top={top + 19} width={62} size={7.8} leading={9.7} weight={900} color={dark ? C.teal : C.tealDark} maxLines={1}>
              0{index + 1}
            </T>
            <T x={x + 14} top={top + 53} width={62} size={8} leading={10} weight={900} color={dark ? C.white : C.dark} uppercase maxLines={1}>
              {label}
            </T>
            <T x={x + 14} top={top + 89} width={62} size={8.4} leading={11} weight={900} color={dark ? "#D5E3E1" : C.muted} maxLines={4}>
              {body}
            </T>
            {index < 4 ? <Arrow x1={x + 91} x2={x + 100} top={top + 70} /> : null}
          </div>
        );
      })}
      <T x={49} top={layout.benefitsLabelTop} width={250} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>
        What this gives {owner}
      </T>
      {[
        ["ONE TEAM TO CREATE DEMAND", `Google Ads, local SEO, GBP and ${spec.pageNouns[1]}.`],
        ["ONE ROUTE TO CONVERT IT", "Landing-page conversion, enquiry ownership and patient progression."],
        ["ONE VIEW TO DECIDE", "Bookings, attendance, new paying patients and the next recommended action."],
      ].map(([label, body], index) => {
        const x = 49 + index * 171;
        const top = layout.benefitTop;
        return (
          <div key={label}>
            {index ? <div style={{ position: "absolute", left: pt(x - 15), top: pt(top - 3), width: pt(0.8), height: pt(125), background: C.line }} /> : null}
            <T x={x} top={top} width={28} size={7.8} leading={9.7} weight={900} color={C.tealDark} maxLines={1}>
              0{index + 1}
            </T>
            <T x={x} top={top + 33} width={142} size={8.2} leading={10.3} weight={900} color={C.dark} uppercase maxLines={2}>
              {label}
            </T>
            <T x={x} top={top + 80} width={142} size={8.8} leading={11.7} color={C.muted} maxLines={4}>
              {body}
            </T>
          </div>
        );
      })}
      <Box x={49} top={layout.finalBoxTop} width={494} height={62} fill={C.dark} radius={6} />
      <T x={73} top={layout.finalTextTop} width={446} size={9} leading={11.7} weight={900} color={C.white} align="center" maxLines={3}>
        Generate demand for {service}. See how far each enquiry progressed. Decide what {short} should improve next.
      </T>
    </Page>
  );
}

function page5(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const owner = ownerFirst(snapshot, spec);
  const service = priority(snapshot, spec);
  const media = money(snapshot.commercial.mediaSpend.value);
  const build = [
    "Audit and repair the existing Google Ads account and conversion setup.",
    `Build one ${service} Search campaign set, with non-brand demand and brand protection where evidence supports it.`,
    "Configure location, schedule, device, negative-keyword, budget and clinic-approved compliance controls.",
    "Create the agreed advert copy and campaign assets.",
    "Connect form, telephone and WhatsApp actions where technically and legally supported.",
  ];
  const manage = [
    "Search terms and irrelevant-query exclusions.",
    "Location, schedule and device performance.",
    "Advert relevance, approved messaging and asset performance.",
    "Bids, budget pacing and conversion quality.",
    "Lead quality against bookings, attendance and paid-start evidence.",
    "The highest-priority in-scope improvement, not a list of vanity metrics.",
  ];
  return (
    <Page id="V5Page05GoogleAds" page={5} background={C.paper} snapshot={snapshot} section="Google Ads">
      <T x={49} top={88} width={285} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>
        Capture high-intent demand now
      </T>
      <T x={49} top={124} width={486} size={27.5} leading={29.4} weight={900} color={C.dark} maxLines={5}>
        Put {short} in front of local patients when they search for {service}.
      </T>
      <T x={49} top={241} width={486} size={8.8} leading={11.2} weight={900} color={C.muted} maxLines={2}>
        {service}. One {short} location. Up to {media} planned monthly Google media once live, subject to demand forecast and capacity.
      </T>
      <Box x={49} top={296} width={232} height={351} fill={C.cream} radius={10} />
      <T x={70} top={320} width={180} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>
        What we build
      </T>
      {build.map((item, index) => <Bullet key={item} x={70} top={360 + index * 52} width={190} size={9} maxLines={5}>{item}</Bullet>)}
      <Box x={311} top={296} width={232} height={351} fill={C.dark} radius={10} />
      <T x={332} top={320} width={190} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>
        What we manage each week
      </T>
      {manage.map((item, index) => <Bullet key={item} x={332} top={360 + index * 42} width={190} dark size={9} maxLines={4}>{item}</Bullet>)}
      <Box x={49} top={675} width={494} height={78} fill={C.mint} radius={7} />
      <T x={68} top={692} width={172} size={7.5} leading={9.3} weight={900} color={C.tealDark} uppercase maxLines={1}>
        What {owner} will see
      </T>
      <T x={240} top={687} width={283} size={8.6} leading={11.5} weight={900} color={C.dark} maxLines={4}>
        Qualified enquiries and {spec.ownerClosure}. A cheaper lead is not automatically a better commercial result.
      </T>
      <T x={49} top={767} width={494} size={8.2} leading={10.5} weight={900} color={C.copper} align="center" maxLines={2}>
        Google media is paid directly by {short} and released only after tracking, team coverage and capacity readiness pass.
      </T>
    </Page>
  );
}

function page6(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const image = snapshot.assets.sectorImages.journey;
  return (
    <Page id="V5Page06LandingConversion" page={6} background={C.dark} dark snapshot={snapshot} section="Landing page and conversion">
      <T x={49} top={88} width={330} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>
        Turn search intent into a clinic enquiry
      </T>
      <T x={49} top={124} width={480} size={29} leading={31.03} weight={900} color={C.white} maxLines={3}>
        {`Turn ${clinicShort(snapshot, spec)}'s paid-search traffic into ${spec.page6Headline}`}
      </T>
      <T x={49} top={232} width={480} size={9.5} leading={13} weight={800} color="#C7D8D6" maxLines={3}>
        We build or optimise one mobile-first, tracked {spec.patientPageNoun} around the questions prospective patients need answered before they take the next step.
      </T>
      <ImageCrop url={image.url} alt={image.alt || "Clinic conversion journey"} x={363} top={310} width={180} height={351} position="center center" brightness={0.9} />
      <Box x={363} top={310} width={180} height={351} fill={C.paper} radius={10} style={{ opacity: 0.92 }} />
      <T x={49} top={306} width={230} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>
        The patient decision path
      </T>
      {[
        ["01", "RECOGNISE", "The page immediately reflects the treatment and local intent behind the search."],
        ["02", "TRUST", "Clinician credentials, proof, reassurance and approved claims reduce uncertainty."],
        ["03", "UNDERSTAND", `Clear ${spec.pageNouns[2]}, FAQs and consultation expectations answer the next question.`],
        ["04", "ACT", "Call, form and WhatsApp actions are obvious, mobile-friendly and measured."],
      ].map(([num, label, body], index) => {
        const top = 348 + index * 82;
        return (
          <div key={num}>
            <span style={{ position: "absolute", left: pt(54), top: pt(top), width: pt(20), height: pt(20), borderRadius: "50%", background: index === 0 || index === 3 ? C.teal : "#31575A" }} />
            <T x={53} top={top + 5} width={22} size={7.3} leading={8.9} weight={900} color={index === 0 || index === 3 ? C.dark : C.white} align="center" maxLines={1}>{num}</T>
            <T x={94} top={top - 1} width={98} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>{label}</T>
            <T x={194} top={top - 3} width={144} size={8.7} leading={11.6} color="#D0DFDD" maxLines={5}>{body}</T>
            {index < 3 ? <div style={{ position: "absolute", left: pt(63.4), top: pt(top + 23), width: pt(1.2), height: pt(46), background: "#31575A" }} /> : null}
          </div>
        );
      })}
      <T x={383} top={332} width={140} size={7.8} leading={9.7} weight={900} color={C.tealDark} uppercase maxLines={1}>Delivered in scope</T>
      {[
        `${priority(snapshot, spec)} positioning and patient-facing copy.`,
        "Offer structure without unsupported urgency or discount dependence.",
        "Proof, clinician reassurance, FAQs and clear actions.",
        "Mobile usability and priority-page friction improvements.",
        "Tracking for agreed calls, forms and WhatsApp actions.",
        "One material conversion test at a time, when traffic supports it.",
      ].map((item, index) => <Bullet key={item} x={383} top={372 + index * 43} width={140} size={8.7} maxLines={5}>{item}</Bullet>)}
      <Box x={49} top={690} width={494} height={76} fill={C.dark2} stroke="#31575A" radius={7} />
      <T x={68} top={706} width={205} size={7.5} leading={9.3} weight={900} color={C.copperLight} uppercase maxLines={1}>Clinical and creative control</T>
      <T x={68} top={732} width={455} size={8} leading={10.6} color="#D2E0DE" maxLines={4}>{spec.complianceCopy}</T>
    </Page>
  );
}

function page7(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const service = priority(snapshot, spec);
  return (
    <Page id="V5Page07SeoGbpWebsite" page={7} background={C.cream} snapshot={snapshot} section="SEO, Google Business Profile and website">
      <T x={49} top={88} width={285} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>Build compounding local demand</T>
      <T x={49} top={124} width={482} size={29} leading={31.03} weight={900} color={C.dark} maxLines={4}>{`Build ${short}'s local authority while paid search for ${service} learns.`}</T>
      <T x={49} top={226} width={482} size={9.4} leading={12.8} weight={800} color={C.muted} maxLines={3}>Google Ads captures patients searching now. SEO, Google Business Profile and a clearer website route help {short} be found, trusted and chosen over time.</T>
      <T x={49} top={304} width={220} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>{spec.pageNouns[3]}</T>
      <T x={311} top={304} width={232} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>Local discovery + website</T>
      <T x={49} top={333} width={231} size={7.5} leading={9.3} weight={900} color={C.tealDark} maxLines={2}>1 baseline | 1 {spec.seoPageLabel} | up to 2 assets/month | up to 10 internal links</T>
      <T x={311} top={333} width={232} size={7.5} leading={9.3} weight={900} color={C.tealDark} maxLines={2}>1 Google Business Profile | 4 updates/month | 1 website route</T>
      <div style={{ position: "absolute", left: pt(296), top: pt(380), width: pt(0.8), height: pt(300), background: C.line }} />
      {[
        "Establish the technical, indexation and search-visibility baseline.",
        `Rewrite or substantially optimise ${short}'s ${service} page.`,
        `Create supporting search-led assets, such as a ${service} FAQ, decision guide or local patient question page.`,
        "Implement relevant internal-link improvements.",
        "Monitor Search Console and priority local-search performance.",
      ].map((item, index) => <Bullet key={item} x={49} top={390 + index * 52} width={231} size={9} maxLines={5}>{item}</Bullet>)}
      {[
        "Optimise one GBP location: categories, services, details, hours, links and tracking.",
        "Publish clinic-approved GBP updates using supplied or approved assets.",
        "Create a compliant review-request and non-clinical response playbook.",
        `Improve the ${service} route inside ${short}'s website: mobile, message, trust, action and tracking friction.`,
        "Document larger technical or design work that requires separate scope.",
      ].map((item, index) => <Bullet key={item} x={311} top={390 + index * 52} width={232} size={9} maxLines={5}>{item}</Bullet>)}
      <Box x={49} top={700} width={494} height={73} fill={C.dark} radius={7} />
      <T x={68} top={717} width={165} size={7.5} leading={9.3} weight={900} color={C.teal} uppercase maxLines={1}>What {ownerFirst(snapshot, spec)} will see</T>
      <T x={235} top={711} width={288} size={8.4} leading={11.2} weight={900} color={C.white} maxLines={4}>Local and non-brand visibility, organic clicks, GBP calls and website actions, then qualified enquiries and {spec.ownerClosure} where attribution supports it.</T>
      <T x={49} top={779} width={494} size={8} leading={10.2} weight={900} color={C.muted} align="center" maxLines={2}>Organic growth and rankings are not guaranteed. The foundation phase establishes the technical, local and content direction; authority and search visibility are improved and measured across the partnership.</T>
    </Page>
  );
}

function page8(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  return (
    <Page id="V5Page08TrackingOptimisation" page={8} background={C.dark} dark snapshot={snapshot} section="Tracking, optimisation and Mission Control">
      <T x={49} top={88} width={260} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>A lead is not the finish line</T>
      <T x={49} top={124} width={480} size={30} leading={32.1} weight={900} color={C.white} maxLines={4}>We diagnose the stage that is failing, then improve that stage.</T>
      {spec.stageMap.map((stage, index) => {
        const column = index % 4;
        const row = Math.floor(index / 4);
        const x = 49 + column * 127;
        const top = 245 + row * 72;
        const active = index === 0 || index === 5;
        return (
          <div key={stage}>
            <Box x={x} top={top} width={112} height={50} fill={active ? C.teal : C.dark2} stroke="#31575A" radius={6} />
            <T x={x + 10} top={top + 10} width={22} size={7.5} leading={9.3} weight={900} color={active ? C.dark : C.teal} maxLines={1}>0{index + 1}</T>
            <T x={x + 35} top={top + 10} width={67} size={8} leading={10} weight={900} color={active ? C.dark : C.white} uppercase maxLines={2}>{stage}</T>
            {column < 3 ? <Arrow x1={x + 113} x2={x + 126} top={top + 25} color={C.teal} /> : null}
          </div>
        );
      })}
      <T x={49} top={395} width={275} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>How the optimisation changes</T>
      {[
        ["LOW QUALIFIED SEARCH DEMAND", "Review market, targeting, bids, schedule and budget."],
        ["CLICKS BUT FEW ENQUIRIES", "Improve message, proof, offer, mobile friction or landing page."],
        ["ENQUIRIES BUT FEW BOOKINGS", "Inspect lead quality, speed, contactability, ownership and follow-up."],
        spec.finalLeak,
      ].map(([signal, action], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = 49 + column * 253;
        const top = 430 + row * 82;
        return (
          <div key={String(signal)}>
            <Box x={x} top={top} width={241} height={69} fill={C.dark2} stroke="#31575A" radius={6} />
            <T x={x + 14} top={top + 13} width={102} size={7.7} leading={9.6} weight={900} color={index > 1 ? C.copperLight : C.teal} uppercase maxLines={3}>{signal}</T>
            <T x={x + 121} top={top + 12} width={105} size={8.4} leading={11} color="#D1E0DE" maxLines={5}>{action}</T>
          </div>
        );
      })}
      <Box x={49} top={596} width={494} height={160} fill={C.paper} radius={10} />
      <T x={69} top={617} width={190} size={7.8} leading={9.7} weight={900} color={C.tealDark} uppercase maxLines={1}>Measurement setup</T>
      {["Connect GTM, GA4, Google Ads, Search Console and GBP source tracking.", "Track agreed form, telephone and WhatsApp actions.", "Apply source parameters and record attribution gaps."].map((item, index) => <Bullet key={item} x={69} top={653 + index * 34} width={208} size={8.4} maxLines={3}>{item}</Bullet>)}
      <div style={{ position: "absolute", left: pt(296), top: pt(617), width: pt(0.8), height: pt(124), background: C.line }} />
      <T x={319} top={617} width={202} size={7.8} leading={9.7} weight={900} color={C.tealDark} uppercase maxLines={1}>Mission Control readiness</T>
      {["Each agreed enquiry route has an owner, backup, response target and next action.", "Five clinic-approved non-clinical response and follow-up templates.", "Ten end-to-end tests; all retain source, owner and next action before media."].map((item, index) => <Bullet key={item} x={319} top={653 + index * 34} width={202} size={8.4} maxLines={3}>{item}</Bullet>)}
      <Box x={49} top={766} width={494} height={32} fill={C.dark2} stroke="#31575A" radius={6} />
      <T x={67} top={772} width={458} size={7.8} leading={9.8} weight={900} color={C.white} align="center" maxLines={2}>{snapshot.journey.clinicalBoundary}</T>
    </Page>
  );
}

function page9(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  return (
    <Page id="V5Page09Roadmap" page={9} background={C.cream} snapshot={snapshot} section="The growth roadmap">
      <T x={49} top={88} width={255} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>Build, prove, then compound</T>
      <T x={49} top={124} width={482} size={27.5} leading={29.4} weight={900} color={C.dark} maxLines={4}>Six months to build it properly, prove what works and improve what happens next.</T>
      <T x={49} top={228} width={480} size={9.6} leading={13} weight={900} color={C.muted} maxLines={3}>Months one to three create the system and early evidence. Months four to six show whether it can become a dependable growth route.</T>
      {[
        ["01", "MONTHS 1-2", "FOUNDATION", `Confirm patient value, capacity, claims and responsibilities. Repair tracking and enquiry ownership. Build Search, the ${spec.patientPageNoun} and priority SEO/GBP foundations. Test the patient route before releasing media.`, "GATE | Tracking, clinic readiness and test journeys pass."],
        ["02", "MONTHS 3-4", "OPTIMISE + PROVE", `Improve search terms, adverts, page conversion, enquiry quality and follow-up. Publish supporting SEO and GBP work. Connect enquiries to ${spec.ownerClosure}. Replace page 3 assumptions with ${short}'s actual data.`, "GATE | Month-three evidence review: scale, hold or change."],
        ["03", "MONTHS 5-6", "SCALE + COMPOUND", "Increase media only where economics and capacity support it. Expand winning demand, strengthen organic visibility, improve conversion and begin measuring completed journeys and retained patient value.", "GATE | Month-five recommendation sets the next growth plan."],
      ].map(([num, period, verb, work, gate], index) => {
        const top = [304, 458, 612][index];
        const fill = index === 1 ? C.mint : C.paper;
        const color = index === 2 ? C.copper : C.tealDark;
        return (
          <div key={num}>
            <Box x={49} top={top} width={494} height={135} fill={fill} stroke={C.line} radius={8} />
            <span style={{ position: "absolute", left: pt(60), top: pt(top + 13), width: pt(30), height: pt(30), borderRadius: "50%", background: color }} />
            <T x={62} top={top + 20} width={26} size={8.2} leading={10.2} weight={900} color={C.white} align="center" maxLines={1}>{num}</T>
            <T x={106} top={top + 16} width={110} size={8.4} leading={10.5} weight={900} color={color} uppercase maxLines={1}>{period}</T>
            <T x={106} top={top + 44} width={170} size={13} leading={16} weight={900} color={C.dark} uppercase maxLines={1}>{verb}</T>
            <T x={106} top={top + 73} width={415} size={9.1} leading={11.8} color={C.muted} maxLines={4}>{work}</T>
            <T x={106} top={top + 116} width={415} size={8.2} leading={10.3} weight={900} color={color} uppercase maxLines={2}>{gate}</T>
          </div>
        );
      })}
      <Box x={49} top={770} width={494} height={30} fill={C.dark} radius={5} />
      <T x={67} top={776} width={458} size={7.9} leading={9.8} weight={900} color={C.white} align="center" maxLines={2}>Problems are reviewed monthly. {short} does not wait until month six to find weak demand, missed follow-up or a capacity constraint.</T>
    </Page>
  );
}

function page10(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const owner = ownerFirst(snapshot, spec);
  const service = priority(snapshot, spec);
  const packageName = selectedPackageName(snapshot);
  const scope = snapshot.scope.filter((line) => line.inclusionStatus !== "excluded").slice(0, 3);
  return (
    <Page id="V5Page10ManagementScope" page={10} background={C.paper} snapshot={snapshot} section="Management, scope and ownership">
      <T x={49} top={88} width={240} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>A managed growth function</T>
      <T x={49} top={124} width={486} size={28} leading={29.96} weight={900} color={C.dark} maxLines={4}>{`ClinicGrower becomes ${short}'s managed growth function, not another dashboard for ${owner} to run.`}</T>
      <Box x={49} top={251} width={494} height={90} fill={C.dark} radius={7} />
      <T x={67} top={267} width={240} size={7.5} leading={9.3} weight={900} color={C.teal} uppercase maxLines={1}>Exact initial partnership scope</T>
      <T x={67} top={290} width={458} size={8} leading={10.2} weight={900} color={C.white} uppercase maxLines={2}>Demand | {packageName}: {scope[0]?.title || service} | {scope[0]?.quantityLimit || `one ${short} location`}.</T>
      <T x={67} top={315} width={458} size={7.8} leading={9.9} weight={900} color={C.white} uppercase maxLines={2}>Organic + progression | {scope[0]?.exclusion || "larger rebuilds and third-party charges excluded unless agreed"} | one connected patient journey.</T>
      <T x={49} top={373} width={250} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>What we need from your team</T>
      {[[`${owner.toUpperCase()} | OWNER`, "60 MIN / MONTH", `Demand, capacity, ${spec.ownerClosure} and what changes next.`], [`${short.toUpperCase()} MANAGER`, "30 MIN / WEEK", "Exceptions, overdue actions and what needs attention now."], [`${short.toUpperCase()} COORDINATOR`, "3 CHECKS / DAY", `Short queue checks. Patient contact remains with ${short}.`]].map(([role, commitment, body], index) => {
        const x = 49 + index * 168;
        return (
          <div key={role}>
            {index ? <div style={{ position: "absolute", left: pt(x - 15), top: pt(410), width: pt(0.8), height: pt(104), background: C.line }} /> : null}
            <T x={x} top={411} width={145} size={7.7} leading={9.6} weight={900} color={index === 2 ? C.copper : C.tealDark} uppercase maxLines={1}>{role}</T>
            <T x={x} top={439} width={145} size={13} leading={16} weight={900} color={C.dark} uppercase maxLines={1}>{commitment}</T>
            <T x={x} top={473} width={145} size={8.5} leading={11.3} color={C.muted} maxLines={4}>{body}</T>
          </div>
        );
      })}
      <Rule x1={49} x2={536} top={543} color={C.line} width={0.9} />
      <T x={49} top={556} width={230} size={7.5} leading={9.3} weight={900} color={C.tealDark} uppercase maxLines={2}>ClinicGrower is operationally accountable for</T>
      <T x={311} top={556} width={220} size={7.5} leading={9.3} weight={900} color={C.copper} uppercase maxLines={2}>{short} remains accountable for</T>
      {["Growth strategy, prioritisation and recommended actions.", "Ads, landing page, CRO, SEO and GBP delivery.", "Tracking, Mission Control and commercial analysis."].map((item, index) => <Bullet key={item} x={49} top={605 + index * 42} width={231} size={8.5} maxLines={3}>{item}</Bullet>)}
      {["Clinical claims, pricing, offers, capacity and approvals.", "Patient replies, bookings, deposits, clinic-system records and outcome accuracy.", "Suitability, consent, treatment, complaints, care, budget and access."].map((item, index) => <Bullet key={item} x={311} top={605 + index * 42} width={232} size={8.5} maxLines={3}>{item}</Bullet>)}
      <Box x={49} top={728} width={494} height={69} fill={C.mint} radius={5} />
      <T x={67} top={741} width={210} size={7.5} leading={9.3} weight={900} color={C.tealDark} uppercase maxLines={1}>Ownership</T>
      <T x={67} top={762} width={210} size={8} leading={10.2} weight={900} color={C.dark} maxLines={3}>{short} owns the accounts, website, tracking assets and data.</T>
      <div style={{ position: "absolute", left: pt(296), top: pt(741), width: pt(0.7), height: pt(45), background: "#B6D8D4" }} />
      <T x={314} top={741} width={211} size={7.5} leading={9.3} weight={900} color={C.tealDark} uppercase maxLines={1}>Limits and exclusions</T>
      <T x={314} top={762} width={211} size={8} leading={10.2} weight={900} color={C.dark} maxLines={3}>Extra treatments, locations, channels, full rebuilds and third-party charges unless agreed.</T>
    </Page>
  );
}

function page11(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const proof = selectedProof(snapshot);
  const visibleProof = proof.length ? proof : snapshot.proof;
  const tanja = findProofAsset(visibleProof, ["dr tanja", "tanja phillips", "permissioned clinic owner testimonial"]);
  const resultRows = [
    {
      asset: findProofAsset(visibleProof, ["262.73", "high-intent"]),
      value: "+262.73%",
      label: "PPC CONVERSIONS",
      note: "versus previous year",
    },
    {
      asset: findProofAsset(visibleProof, ["31.41", "cost-per-enquiry", "cost per enquiry", "cost per lead"]),
      value: "-31.41%",
      label: "PPC COST PER LEAD",
      note: "period not published",
    },
    {
      asset: findProofAsset(visibleProof, ["100.6", "organic traffic", "consultation demand"]),
      value: "+100.6%",
      label: "ORGANIC TRAFFIC",
      note: "reaching 2.6K monthly users",
    },
  ];
  const evidenceRows = [
    {
      asset: findProofAsset(visibleProof, ["dreamamed", "163"]),
      name: "DREAMAMED",
      value: "+163%",
      note: "lead conversions | period not published",
    },
    {
      asset: findProofAsset(visibleProof, ["mediskin", "205"]),
      name: "MEDISKIN",
      value: "+205%",
      note: "conversions | Jan-May 2024",
    },
  ];
  return (
    <Page id="V5Page11PublishedProof" page={11} background={C.cream} snapshot={snapshot} section="Published clinic evidence">
      <T x={49} top={88} width={265} size={8} leading={10} weight={900} color={C.tealDark} uppercase maxLines={1}>Relevant proof, not a promise</T>
      <T x={49} top={124} width={480} size={28.5} leading={30.5} weight={900} color={C.dark} maxLines={4}>Marketing results matter. What happens after the lead matters more.</T>
      <article
        data-v5-proof-pair
        data-v5-proof-slot="featured-client-story"
        data-v5-proof-media-url={TANJA_URL}
        style={{
          position: "absolute",
          left: pt(49),
          top: pt(242),
          width: pt(220),
          height: pt(294),
          overflow: "hidden",
          textDecoration: "none",
        }}
      >
        <span
          aria-label="Dr Tanja Phillips client story"
          role="img"
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: C.pale,
            backgroundImage: `url("${TANJA_URL}")`,
            backgroundPosition: "center center",
            backgroundRepeat: "no-repeat",
            backgroundSize: "cover",
          }}
        />
        <span aria-hidden style={{ position: "absolute", inset: 0, background: C.dark, opacity: 0.45 }} />
        <span style={{ position: "absolute", left: pt(82), top: pt(92), width: pt(56), height: pt(56), borderRadius: "50%", background: C.teal }} />
        <span style={{ position: "absolute", left: pt(104), top: pt(105), width: 0, height: 0, borderTop: `${pt(13)} solid transparent`, borderBottom: `${pt(13)} solid transparent`, borderLeft: `${pt(20)} solid ${C.dark}` }} />
        <span style={{ position: "absolute", left: pt(23), top: pt(184), width: pt(174), color: C.white, fontSize: pt(8.2), lineHeight: pt(10.2), fontWeight: 900, textAlign: "center" }}>
          DR TANJA PHILLIPS
        </span>
        <span style={{ position: "absolute", left: pt(23), top: pt(214), width: pt(174), color: C.teal, fontSize: pt(7.7), lineHeight: pt(9.6), fontWeight: 900, textAlign: "center", textTransform: "uppercase" }}>
          Client story | 2:43
        </span>
      </article>
      <T x={299} top={245} width={241} size={7.8} leading={9.7} weight={900} color={C.tealDark} uppercase maxLines={1}>Published client evidence</T>
      <T x={299} top={282} width={241} size={15.2} leading={20.4} weight={900} color={C.dark} maxLines={6}>{tanja?.copy || "\"They have taken the time to help us drill down into the detail to optimise the right leads.\""}</T>
      {resultRows.map((row, index) => {
        const top = 416 + index * 57;
        return (
          <div key={row.label} data-v5-proof-pair data-v5-proof-slot={`result-${index + 1}`} data-v5-proof-media-status="none">
            <T x={299} top={top} width={92} size={13.5} leading={17} weight={900} color={C.tealDark} maxLines={1}>{row.value}</T>
            <T x={397} top={top} width={143} size={8} leading={10} weight={900} color={C.dark} uppercase maxLines={2}>{row.label}</T>
            <T x={397} top={top + 26} width={143} size={8} leading={10} color={C.muted} maxLines={2}>{row.note}</T>
          </div>
        );
      })}
      <PlayButton href={safeV19Href(snapshot.links.videoUrl, VIMEO_TANJA)} label="Play client story" displayUrl="vimeo.com/1026436587" x={299} top={593} width={170} dark={false} />
      <QrAsset url={QR_TANJA} label="Scan to watch Dr Tanja Phillips client story" x={488} top={589} size={49} />
      <T x={488} top={645} width={49} size={7.5} leading={9.3} weight={900} color={C.tealDark} align="center" uppercase maxLines={1}>Scan</T>
      <Button href={CASE_STUDY} label="Open the published case study >" x={299} top={663} width={241} height={44} fill={C.paper} color={C.tealDark} stroke={C.line} size={8.2} />
      <T x={49} top={583} width={220} size={7.7} leading={9.6} weight={900} color={C.tealDark} uppercase maxLines={1}>More published clinic evidence</T>
      {evidenceRows.map((row, index) => {
        const top = [616, 707][index];
        const height = [78, 68][index];
        return (
          <article key={row.name} data-v5-proof-pair data-v5-proof-slot={`published-row-${index + 1}`} data-v5-proof-media-status="none" style={{ position: "absolute", left: pt(49), top: pt(top), width: pt(220), height: pt(height), background: C.paper, borderRadius: pt(6), boxSizing: "border-box" }}>
            <span style={{ position: "absolute", left: pt(16), top: pt(16), width: pt(90), color: C.tealDark, fontSize: pt(7.6), lineHeight: pt(9.5), fontWeight: 900, overflow: "hidden", textTransform: "uppercase", whiteSpace: "nowrap" }}>{row.name}</span>
            <span style={{ position: "absolute", left: pt(119), top: pt(12), width: pt(80), color: C.dark, fontSize: pt(14.5), lineHeight: pt(18), fontWeight: 900, overflow: "hidden", textAlign: "right", whiteSpace: "nowrap" }}>{row.value}</span>
            <span style={{ position: "absolute", left: pt(16), top: pt(43), width: pt(183), color: C.muted, fontSize: pt(7.6), lineHeight: pt(9.6), overflow: "hidden", whiteSpace: "nowrap" }}>{row.note}</span>
            <span style={{ position: "absolute", left: pt(161), top: pt(index === 0 ? 57 : 41), width: pt(38), color: C.tealDark, fontSize: pt(7.5), lineHeight: pt(9.3), fontWeight: 900, overflow: "hidden", textAlign: "right", textTransform: "uppercase", whiteSpace: "nowrap" }}>Open &gt;</span>
          </article>
        );
      })}
      <T x={299} top={720} width={241} size={7.7} leading={9.7} weight={900} color={C.muted} maxLines={4}>Cross-sector published clinic evidence. It shows the commercial improvement ClinicGrower measures; it is not a forecast or guarantee for {clinicShort(snapshot, spec)}.</T>
    </Page>
  );
}

function page12(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const founder = snapshot.assets.founderVideoThumbnail;
  return (
    <Page id="V5Page12WhyClinicGrower" page={12} background={C.dark} dark snapshot={snapshot} section="Why ClinicGrower">
      <T x={49} top={88} width={330} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>A clinic growth partner, not a lead vendor</T>
      <T x={49} top={124} width={478} size={29} leading={31.03} weight={900} color={C.white} maxLines={5}>Built for owners who need the marketing and the clinic operation to work together.</T>
      <T x={49} top={256} width={475} size={9.5} leading={13} color="#CADAD8" maxLines={5}>{spec.founderContext} ClinicGrower connects that commercial route as one system.</T>
      <ImageCrop url={founder?.url} alt={founder?.alt || "ClinicGrower founder film"} x={49} top={357} width={306} height={172} position="center center" />
      <Box x={49} top={482} width={306} height={47} fill={C.dark} radius={0} style={{ opacity: 0.82 }} />
      <span style={{ position: "absolute", left: pt(65), top: pt(477), width: pt(34), height: pt(34), borderRadius: "50%", background: C.teal }} />
      <span style={{ position: "absolute", left: pt(78), top: pt(485), width: 0, height: 0, borderTop: `${pt(9)} solid transparent`, borderBottom: `${pt(9)} solid transparent`, borderLeft: `${pt(14)} solid ${C.dark}` }} />
      <T x={110} top={487} width={219} size={7.8} leading={9.7} weight={900} color={C.teal} uppercase maxLines={1}>Max Sharpe | Founder</T>
      <T x={110} top={507} width={219} size={11} leading={13.5} weight={900} color={C.white} maxLines={1}>Why I built ClinicGrower</T>
      <PlayButton href={safeV19Href(snapshot.links.videoUrl, VIMEO_MAX)} label="Watch Max - 2 minute founder film" displayUrl="vimeo.com/1008757315" x={49} top={548} width={306} dark={false} />
      <Box x={402} top={378} width={94} height={94} fill={C.white} radius={5} />
      <QrAsset url={QR_FOUNDER} label="Scan to watch ClinicGrower founder film" x={402} top={378} size={94} />
      <T x={380} top={495} width={137} size={7.7} leading={9.6} weight={900} color={C.teal} align="center" uppercase maxLines={1}>Scan to watch</T>
      <T x={380} top={527} width={137} size={8.4} leading={11.3} color="#C8D9D7" align="center" maxLines={4}>Use the QR code if your email or phone preview blocks PDF links.</T>
      <Box x={380} top={586} width={137} height={58} fill={C.dark2} stroke="#31575A" radius={6} />
      <T x={394} top={597} width={109} size={7.5} leading={9.3} weight={900} color={C.teal} align="center" uppercase maxLines={1}>Aesthetics Awards</T>
      <T x={394} top={617} width={109} size={7.6} leading={9.4} weight={900} color={C.white} align="center" uppercase maxLines={2}>2025 Highly Commended{"\n"}2026 Finalist</T>
      <T x={49} top={679} width={255} size={8} leading={10} weight={900} color={C.teal} uppercase maxLines={1}>One accountable commercial route</T>
      {["We build demand, not just report it.", `We improve ${short}'s patient route without taking clinical control.`, `${short} owns its accounts, assets and data.`, "We scale only when the evidence supports it."].map((item, index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = 49 + column * 250;
        const top = 715 + row * 47;
        return (
          <div key={item}>
            <Check x={x + 1} top={top + 8} color={C.teal} />
            <T x={x + 20} top={top} width={218} size={8.8} leading={11.3} weight={900} color={C.white} maxLines={3}>{item}</T>
          </div>
        );
      })}
    </Page>
  );
}

function page13(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const owner = ownerFirst(snapshot, spec);
  const packageName = selectedPackageName(snapshot);
  const displayName = investmentDisplayName(snapshot);
  const monthly = snapshot.commercial.monthlyFeeCents;
  const setup = snapshot.commercial.setupFeeCents;
  const daily = dailyFeeLabel(monthly);
  const media = money(snapshot.commercial.mediaSpend.value);
  return (
    <Page id="V5Page13PartnershipInvestment" page={13} background={C.dark} dark snapshot={snapshot} section="Your monthly growth partnership">
      <T x={49} top={88} width={420} size={8.2} leading={10.2} weight={900} color={C.teal} uppercase maxLines={1}>One accountable team | one monthly ClinicGrower fee</T>
      <T x={49} top={124} width={482} size={25.5} leading={27.3} weight={900} color={C.white} maxLines={3}>A joined-up team across marketing and growth operations, for about {daily} per day.</T>
      <T x={49} top={214} width={482} size={10.5} leading={14.2} color="#D2E0DE" maxLines={4}>{short} gets one team across marketing, the patient journey and commercial optimisation - without disconnected suppliers or reports for {owner} to manage.</T>
      <Box x={49} top={275} width={494} height={184} fill={C.paper} radius={10} />
      <span style={{ position: "absolute", left: pt(49), top: pt(268), width: pt(1), height: pt(1), overflow: "hidden", color: "transparent", fontSize: 0, lineHeight: 0 }}>
        {packageName}
      </span>
      <T x={70} top={295} width={290} size={9.5} leading={11.8} weight={900} color={C.tealDark} uppercase maxLines={1}>{displayName}</T>
      <T x={70} top={327} width={170} size={35} leading={40} weight={900} color={C.dark} maxLines={1}>{money(monthly)}</T>
      <T x={252} top={348} width={180} size={10.5} leading={13} weight={900} color={C.tealDark} uppercase maxLines={1}>+ VAT per month</T>
      <Rule x1={70} x2={520} top={379} color={C.line} width={0.8} />
      <T x={70} top={397} width={180} size={23} leading={28} weight={900} color={C.tealDark} uppercase maxLines={1}>About {daily}</T>
      <T x={252} top={411} width={185} size={10} leading={12.5} weight={900} color={C.dark} uppercase maxLines={1}>Per calendar day*</T>
      <T x={70} top={432} width={448} size={9.1} leading={11.4} color={C.muted} maxLines={2}>*Equivalent of the monthly ClinicGrower service fee, rounded. Excludes VAT, the one-off setup fee and Google media. Billing remains monthly.</T>
      <Box x={49} top={475} width={494} height={126} fill={C.dark2} stroke="#31575A" radius={8} />
      <T x={70} top={492} width={330} size={9.2} leading={11.5} weight={900} color={C.teal} uppercase maxLines={1}>What {short} gets for that monthly fee</T>
      {[["CREATE DEMAND", "Google Ads management, SEO and Google Business Profile."], ["CONVERT DEMAND", "Landing pages, CRO and patient-journey optimisation."], ["SEE THE TRUTH", "Tracking, Mission Control and monthly commercial decisions."]].map(([label, body], index) => (
        <div key={label}>
          <T x={70} top={521 + index * 27} width={125} size={8.3} leading={10.4} weight={900} color={C.teal} uppercase maxLines={1}>{label}</T>
          <T x={202} top={521 + index * 27} width={316} size={9.1} leading={11.4} weight={900} color={C.white} maxLines={1}>{body}</T>
        </div>
      ))}
      <Box x={49} top={619} width={494} height={67} fill={C.paper} radius={7} />
      <T x={70} top={637} width={140} size={8.8} leading={11} weight={900} color={C.tealDark} uppercase maxLines={1}>One-off setup</T>
      <T x={70} top={658} width={190} size={15.5} leading={19} weight={900} color={C.dark} uppercase maxLines={1}>{money(setup)} + VAT once</T>
      <T x={282} top={655} width={236} size={9.8} leading={12.2} weight={900} color={C.muted} maxLines={2}>First invoice only. Not recurring.</T>
      <Box x={49} top={704} width={494} height={86} fill={C.mint} radius={7} />
      <T x={70} top={721} width={320} size={8.8} leading={11} weight={900} color={C.tealDark} uppercase maxLines={1}>Paid to Google | not a ClinicGrower fee</T>
      <T x={70} top={744} width={310} size={16.5} leading={20} weight={900} color={C.dark} uppercase maxLines={1}>Up to {media} per live month</T>
      <T x={70} top={763} width={448} size={9.4} leading={11.8} color={C.muted} maxLines={2}>Separate and paid directly by {short}. £0 planned in month one; released from month two only after readiness, tracking and capacity checks.</T>
    </Page>
  );
}

function page14(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const monthly = money(snapshot.commercial.monthlyFeeCents);
  const setup = money(snapshot.commercial.setupFeeCents);
  const media = money(snapshot.commercial.mediaSpend.value);
  const term = snapshot.commercial.minimumTermMonths || 6;
  const noticeDays = snapshot.commercial.noticePeriodDays || 90;
  const termPhrase = initialTermPhrase(term);
  const termText = initialTermText(term);
  const termEnd = initialTermEndText(term);
  return (
    <Page id="V5Page14BillingTerms" page={14} background={C.cream} snapshot={snapshot} section="How the monthly investment works">
      <T x={49} top={88} width={420} size={8.2} leading={10.2} weight={900} color={C.tealDark} uppercase maxLines={1}>Monthly delivery | monthly billing | controlled media</T>
      <T x={49} top={124} width={482} size={25.5} leading={27.3} weight={900} color={C.dark} maxLines={4}>Billed monthly. Reviewed monthly. Scaled only when the evidence supports it.</T>
      <T x={49} top={214} width={482} size={10.5} leading={14.2} color={C.muted} maxLines={3}>The {termPhrase} minimum gives the system time to learn and improve. {short} still sees a clear monthly bill and retains control of every increase in Google media.</T>
      {[
        ["01 | MONTH 1 | FOUNDATION", `${monthly} + VAT monthly ClinicGrower fee | ${setup} + VAT setup once | £0 planned Google media`, `Build the measurement, campaign, ${spec.patientPageNoun}, patient route and clinic readiness before paid demand is released.`, false],
        ["02 | MONTHS 2-3 | OPTIMISE + PROVE", `${monthly} + VAT per month | Google media up to ${media} per live month, paid directly`, `Release media only after readiness checks. Improve enquiry quality, conversion and follow-up using actual evidence of ${spec.ownerClosure}.`, true],
        ["03 | MONTHS 4-6 | SCALE + COMPOUND", `${monthly} + VAT per month | Google media remains separate, conditional and ${short}-controlled`, `Scale, hold or change the plan using collected revenue, actual spend, patient value, ${short}'s capacity and what Mission Control shows.`, false],
      ].map(([label, priceLine, body, dark], index) => {
        const top = [260, 391, 522][index];
        return (
          <div key={String(label)}>
            <Box x={49} top={top} width={494} height={115} fill={dark ? C.dark : C.paper} stroke={dark ? undefined : C.line} radius={8} />
            <T x={70} top={top + 17} width={430} size={9.2} leading={11.5} weight={900} color={dark ? C.teal : C.tealDark} uppercase maxLines={1}>{label}</T>
            <T x={70} top={top + 45} width={448} size={10.1} leading={13} weight={900} color={dark ? C.white : C.dark} maxLines={2}>{priceLine}</T>
            <T x={70} top={top + 77} width={448} size={9.7} leading={12.6} color={dark ? "#D2E0DE" : C.muted} maxLines={3}>{body}</T>
          </div>
        );
      })}
      <Box x={49} top={654} width={494} height={139} fill={C.mint} radius={8} />
      <T x={70} top={671} width={220} size={9.2} leading={11.5} weight={900} color={C.tealDark} uppercase maxLines={1}>Term at a glance</T>
      <T x={70} top={697} width={310} size={19} leading={23} weight={900} color={C.dark} uppercase maxLines={1}>{term}-month initial minimum</T>
      <T x={70} top={730} width={448} size={10} leading={12.8} color={C.muted} maxLines={5}>{`Initial minimum: ${termText}. The month-three review decides what to scale, hold or change; it does not end the term. Either party may give ${noticeDays} days' written notice at any time, but it cannot expire before the end of month ${termEnd}. Unless terminated, service continues with monthly billing until the notice period ends. The final signed agreement controls.`}</T>
    </Page>
  );
}

function page15(snapshot: ProposalV5Snapshot): ReactElement {
  const spec = sector(snapshot);
  const short = clinicShort(snapshot, spec);
  const owner = ownerFirst(snapshot, spec);
  const service = priority(snapshot, spec);
  const monthly = money(snapshot.commercial.monthlyFeeCents);
  const setup = money(snapshot.commercial.setupFeeCents);
  const media = money(snapshot.commercial.mediaSpend.value);
  const term = snapshot.commercial.minimumTermMonths || 6;
  const noticeDays = snapshot.commercial.noticePeriodDays || 90;
  const termPhrase = initialTermPhrase(term);
  const termEnd = initialTermEndText(term);
  const daily = dailyFeeLabel(snapshot.commercial.monthlyFeeCents);
  const accept = safeV19Href(snapshot.links.acceptUrl || snapshot.links.onlineProposalUrl, `mailto:max@clinicgrower.co.uk?subject=${encodeURIComponent(`Request ${short} Growth Partnership agreement | ${snapshot.proposal.reference}`)}`);
  const question = safeV19Href(snapshot.links.questionUrl, "mailto:max@clinicgrower.co.uk");
  return (
    <Page id="V5Page15Decision" page={15} background={C.paper} snapshot={snapshot} section="The decision">
      <T x={49} top={88} width={220} size={8.2} leading={10.2} weight={900} color={C.tealDark} uppercase maxLines={1}>The decision requested</T>
      <T x={49} top={124} width={494} size={27} leading={28.9} weight={900} color={C.dark} maxLines={3}>Growth should make {short} easier to run. Not harder.</T>
      <T x={49} top={217} width={494} size={10.5} leading={14.2} color={C.muted} maxLines={4}>{`${owner}, you do not need another supplier that stops at enquiries. You need one accountable team generating demand for ${service}, improving ${short}'s patient route and showing how enquiries lead to ${spec.ownerClosure}.`}</T>
      <Box x={49} top={296} width={494} height={255} fill={C.cream} radius={10} />
      <T x={70} top={317} width={300} size={9.2} leading={11.5} weight={900} color={C.tealDark} uppercase maxLines={1}>Prepare the final agreement for</T>
      {[
        `One initial ${termPhrase} Growth Partnership for ${short}'s ${service} patient journey.`,
        `${monthly} + VAT per month - about ${daily} per calendar day for the ClinicGrower service.`,
        `One-off ${setup} + VAT setup fee, charged on the first invoice only.`,
        `Google Ads media up to ${media} per live month, planned from month two and paid directly by ${short} to Google.`,
        `${noticeDays} days' written notice may be given at any time, but cannot expire before the end of month ${termEnd}.`,
      ].map((item, index) => {
        const top = 356 + index * 38;
        return (
          <div key={item}>
            <Check x={71} top={top + 7} color={C.tealDark} />
            <T x={94} top={top} width={420} size={9.6} leading={12.4} weight={900} color={C.dark} maxLines={3}>{item}</T>
          </div>
        );
      })}
      <Button href={accept} label={`Yes - prepare ${short}'s Growth Partnership agreement`} x={49} top={574} width={494} height={58} fill={C.teal} color={C.dark} size={10.4} />
      <T x={49} top={645} width={494} size={9.2} leading={12.2} color={C.muted} align="center" maxLines={3}>This records intent only. Work begins after the final service agreement is signed, the first payment clears and the required access is available. The final agreement controls if there is any inconsistency.</T>
      <Box x={49} top={683} width={494} height={75} fill={C.dark} radius={8} />
      <T x={70} top={695} width={170} size={9.2} leading={11.5} weight={900} color={C.teal} uppercase maxLines={1}>What happens next</T>
      {[["01", "Final agreement and cost schedule issued."], ["02", "Kickoff, access and approvals confirmed."], ["03", "Foundation begins against the readiness gates."]].map(([num, body], index) => {
        const x = 70 + index * 151;
        return (
          <div key={num}>
            {index ? <div style={{ position: "absolute", left: pt(x - 14), top: pt(718), width: pt(0.7), height: pt(32), background: "#31575A" }} /> : null}
            <T x={x} top={724} width={24} size={8.5} leading={10.5} weight={900} color={C.teal} maxLines={1}>{num}</T>
            <T x={x + 29} top={721} width={108} size={8.6} leading={11} weight={900} color={C.white} maxLines={3}>{body}</T>
          </div>
        );
      })}
      <T x={49} top={775} width={215} size={8.5} leading={10.7} weight={900} color={C.tealDark} maxLines={1}>Proposal valid to {compactDate(snapshot.commercial.expiresAt || snapshot.lifecycle.expiresAt)}.</T>
      <Button href={PHONE} label="Call 020 7046 1922" x={278} top={760} width={127} height={42} fill={C.paper} color={C.tealDark} stroke={C.line} size={8.2} />
      <Button href={question} label="Request a change" x={416} top={760} width={127} height={42} fill={C.paper} color={C.muted} stroke={C.line} size={8.2} />
    </Page>
  );
}

export function renderV19ReferencePage(snapshot: ProposalV5Snapshot, page: number): ReactElement {
  assertV19ReferenceReady(`V19 page ${page}`, snapshot);
  switch (page) {
    case 1:
      return page1(snapshot);
    case 2:
      return page2(snapshot);
    case 3:
      return page3(snapshot);
    case 4:
      return page4(snapshot);
    case 5:
      return page5(snapshot);
    case 6:
      return page6(snapshot);
    case 7:
      return page7(snapshot);
    case 8:
      return page8(snapshot);
    case 9:
      return page9(snapshot);
    case 10:
      return page10(snapshot);
    case 11:
      return page11(snapshot);
    case 12:
      return page12(snapshot);
    case 13:
      return page13(snapshot);
    case 14:
      return page14(snapshot);
    case 15:
      return page15(snapshot);
    default:
      throw new Error(`Unsupported V19 reference page ${page}`);
  }
}
