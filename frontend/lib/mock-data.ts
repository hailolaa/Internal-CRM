// ============================================================
// Calendar / Booking mock data
// ============================================================

export const APPOINTMENTS = [
  {
    id: "1",
    time: "09:00",
    duration: 60,
    client: "Emma Wilson",
    treatment: "Lip Filler Consultation",
    provider: "Dr. Smith",
    status: "confirmed",
    value: "£550",
  },
  {
    id: "2",
    time: "10:30",
    duration: 30,
    client: "Sophie Brown",
    treatment: "Botox Touch-up",
    provider: "Dr. Smith",
    status: "confirmed",
    value: "£280",
  },
  {
    id: "3",
    time: "11:30",
    duration: 45,
    client: "Mia Roberts",
    treatment: "Dermal Filler",
    provider: "Dr. Jones",
    status: "pending",
    value: "£400",
  },
  {
    id: "4",
    time: "14:00",
    duration: 60,
    client: "Isabella Clark",
    treatment: "Full Consultation",
    provider: "Dr. Smith",
    status: "confirmed",
    value: "£150",
  },
  {
    id: "5",
    time: "15:30",
    duration: 30,
    client: "Sarah Johnson",
    treatment: "Anti-wrinkle",
    provider: "Dr. Jones",
    status: "pending",
    value: "£350",
  },
  {
    id: "6",
    time: "16:30",
    duration: 45,
    client: "Charlotte Davis",
    treatment: "Skin Assessment",
    provider: "Dr. Smith",
    status: "confirmed",
    value: "£100",
  },
] as const;

export const CALENDAR_HOURS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;

export const WEEK_DAYS = [
  { day: "Mon", date: "3", isToday: false },
  { day: "Tue", date: "4", isToday: false },
  { day: "Wed", date: "5", isToday: false },
  { day: "Thu", date: "6", isToday: true },
  { day: "Fri", date: "7", isToday: false },
  { day: "Sat", date: "8", isToday: false },
  { day: "Sun", date: "9", isToday: false },
] as const;

// ============================================================
// Pipeline mock data
// ============================================================

export interface PipelineDealData {
  id: string;
  name: string;
  value: string;
  treatment: string;
  source: string;
  daysInStage: number;
  avatar: string;
  email: string;
  phone: string;
}

export interface PipelineStageData {
  id: string;
  name: string;
  color: string;
  deals: PipelineDealData[];
}

export const PIPELINE_STAGES: PipelineStageData[] = [
  {
    id: "new",
    name: "New Lead",
    color: "bg-blue-500",
    deals: [
      {
        id: "1",
        name: "Sarah Johnson",
        value: "£350",
        treatment: "Botox",
        source: "Google Ads",
        daysInStage: 1,
        avatar: "SJ",
        email: "sarah@email.com",
        phone: "07700 900123",
      },
      {
        id: "2",
        name: "Olivia Taylor",
        value: "£450",
        treatment: "Dermal Filler",
        source: "Website",
        daysInStage: 3,
        avatar: "OT",
        email: "olivia@email.com",
        phone: "07700 900456",
      },
      {
        id: "8",
        name: "Grace Lee",
        value: "£280",
        treatment: "Anti-wrinkle",
        source: "Instagram",
        daysInStage: 0,
        avatar: "GL",
        email: "grace@email.com",
        phone: "07700 900111",
      },
    ],
  },
  {
    id: "contacted",
    name: "Contacted",
    color: "bg-amber-500",
    deals: [
      {
        id: "3",
        name: "Charlotte Davis",
        value: "£280",
        treatment: "Anti-wrinkle",
        source: "Google Ads",
        daysInStage: 2,
        avatar: "CD",
        email: "charlotte@email.com",
        phone: "07700 900789",
      },
      {
        id: "7",
        name: "Amelia Roberts",
        value: "£320",
        treatment: "Skin Treatment",
        source: "Facebook",
        daysInStage: 1,
        avatar: "AR",
        email: "amelia@email.com",
        phone: "07700 900012",
      },
    ],
  },
  {
    id: "consultation",
    name: "Consultation",
    color: "bg-violet-500",
    deals: [
      {
        id: "4",
        name: "Emma Wilson",
        value: "£550",
        treatment: "Lip Filler",
        source: "Instagram",
        daysInStage: 1,
        avatar: "EW",
        email: "emma@email.com",
        phone: "07700 900345",
      },
      {
        id: "5",
        name: "Mia Roberts",
        value: "£400",
        treatment: "Botox",
        source: "Referral",
        daysInStage: 4,
        avatar: "MR",
        email: "mia@email.com",
        phone: "07700 900678",
      },
    ],
  },
  {
    id: "quoted",
    name: "Quoted",
    color: "bg-teal-500",
    deals: [
      {
        id: "6",
        name: "Isabella Clark",
        value: "£1,200",
        treatment: "Package Deal",
        source: "Website",
        daysInStage: 2,
        avatar: "IC",
        email: "isabella@email.com",
        phone: "07700 900901",
      },
    ],
  },
  {
    id: "won",
    name: "Won 🎉",
    color: "bg-green-500",
    deals: [
      {
        id: "9",
        name: "Sophie Brown",
        value: "£650",
        treatment: "Combo Treatment",
        source: "Referral",
        daysInStage: 0,
        avatar: "SB",
        email: "sophie@email.com",
        phone: "07700 900234",
      },
    ],
  },
];

// ============================================================
// Inbox mock data
// ============================================================

export const INBOX_CONVERSATIONS = [
  {
    id: "1",
    contact: "Sarah Johnson",
    channel: "email",
    preview:
      "Hi, I'm interested in booking a Botox consultation. Do you have availability this week?",
    time: "10 mins ago",
    unread: true,
    starred: true,
    avatar: "SJ",
  },
  {
    id: "2",
    contact: "Emma Wilson",
    channel: "sms",
    preview: "Yes, I can make it at 2pm tomorrow! Looking forward to it 💕",
    time: "1 hour ago",
    unread: true,
    starred: false,
    avatar: "EW",
  },
  {
    id: "3",
    contact: "Sophie Brown",
    channel: "whatsapp",
    preview:
      "Thank you so much! The results are amazing, I'm so happy with everything! 💖",
    time: "3 hours ago",
    unread: false,
    starred: true,
    avatar: "SB",
  },
  {
    id: "4",
    contact: "Charlotte Davis",
    channel: "email",
    preview:
      "Could you send me more information about the dermal filler treatment options?",
    time: "Yesterday",
    unread: false,
    starred: false,
    avatar: "CD",
  },
  {
    id: "5",
    contact: "Olivia Taylor",
    channel: "phone",
    preview: "Missed call - 2 mins",
    time: "Yesterday",
    unread: true,
    starred: false,
    avatar: "OT",
  },
  {
    id: "6",
    contact: "Amelia Roberts",
    channel: "email",
    preview:
      "I saw your Instagram post about the new treatment. How much does it cost?",
    time: "2 days ago",
    unread: false,
    starred: false,
    avatar: "AR",
  },
] as const;

// ============================================================
// Tasks mock data
// ============================================================

export const TASKS = [
  {
    id: "1",
    title: "Follow up with Sarah Johnson",
    description: "Send treatment options and pricing",
    contact: "Sarah Johnson",
    due: "Today, 3pm",
    priority: "high",
    status: "pending",
    category: "Follow-up",
  },
  {
    id: "2",
    title: "Send treatment plan to Emma",
    description: "Include pricing and aftercare info",
    contact: "Emma Wilson",
    due: "Today, 5pm",
    priority: "medium",
    status: "pending",
    category: "Documentation",
  },
  {
    id: "3",
    title: "Call back Charlotte Davis",
    description: "Missed call earlier - interested in anti-wrinkle",
    contact: "Charlotte Davis",
    due: "Tomorrow, 10am",
    priority: "high",
    status: "pending",
    category: "Call",
  },
  {
    id: "4",
    title: "Review Google Ads performance",
    description: "Weekly check-in on campaign metrics",
    contact: null,
    due: "Tomorrow, 2pm",
    priority: "low",
    status: "pending",
    category: "Marketing",
  },
  {
    id: "5",
    title: "Prepare consultation notes",
    description: "For Mia Roberts appointment on Friday",
    contact: "Mia Roberts",
    due: "Feb 8, 9am",
    priority: "medium",
    status: "pending",
    category: "Preparation",
  },
  {
    id: "6",
    title: "Send aftercare instructions",
    description: "Post-treatment follow-up email",
    contact: "Sophie Brown",
    due: "Yesterday",
    priority: "high",
    status: "completed",
    category: "Follow-up",
  },
  {
    id: "7",
    title: "Update patient records",
    description: "Add notes from today's consultations",
    contact: null,
    due: "Today, 6pm",
    priority: "low",
    status: "pending",
    category: "Admin",
  },
] as const;

// ============================================================
// Integrations mock data
// ============================================================

export const INTEGRATIONS = [
  {
    name: "Google Ads",
    description: "Import campaign data and track ROI automatically",
    status: "connected",
    category: "Advertising",
    lastSync: "2 mins ago",
  },
  {
    name: "Meta Ads",
    description: "Connect Facebook and Instagram ads for unified reporting",
    status: "connected",
    category: "Advertising",
    lastSync: "5 mins ago",
  },
  {
    name: "Google Business Profile",
    description: "Manage reviews, posts, and local SEO",
    status: "connected",
    category: "Local",
    lastSync: "1 hour ago",
  },
  {
    name: "Twilio SMS",
    description: "Send SMS reminders and marketing campaigns",
    status: "coming",
    category: "Communications",
  },
  {
    name: "WhatsApp Business",
    description: "Two-way WhatsApp messaging with clients",
    status: "coming",
    category: "Communications",
  },
  {
    name: "Gmail / Outlook",
    description: "Sync email conversations automatically",
    status: "coming",
    category: "Communications",
  },
  {
    name: "Calendly",
    description: "Sync online bookings with your calendar",
    status: "available",
    category: "Scheduling",
  },
  {
    name: "Stripe",
    description: "Payment processing, invoicing, and deposits",
    status: "available",
    category: "Payments",
  },
  {
    name: "Zapier",
    description: "Connect to 5000+ apps with custom workflows",
    status: "coming",
    category: "Automation",
  },
  {
    name: "Mailchimp",
    description: "Email marketing and newsletter automation",
    status: "available",
    category: "Marketing",
  },
  {
    name: "Cliniko",
    description: "Practice management software sync",
    status: "available",
    category: "Practice Management",
  },
  {
    name: "Pabau",
    description: "Clinic software integration",
    status: "available",
    category: "Practice Management",
  },
] as const;

// ============================================================
// Reviews mock data
// ============================================================

export const REVIEWS = [
  {
    id: "1",
    platform: "Google",
    rating: 5,
    author: "Sophie B.",
    text: "Amazing experience! The staff were so friendly and professional. Results exceeded my expectations! Highly recommend to anyone considering treatments here.",
    date: "2 days ago",
    replied: true,
  },
  {
    id: "2",
    platform: "Google",
    rating: 5,
    author: "Emma W.",
    text: "Best clinic in London! Dr. Smith is incredible and really takes time to understand what you want. Will definitely be back!",
    date: "5 days ago",
    replied: true,
  },
  {
    id: "3",
    platform: "Facebook",
    rating: 4,
    author: "Charlotte D.",
    text: "Great results, very happy with my treatment. Booking process could be smoother but overall a wonderful experience.",
    date: "1 week ago",
    replied: false,
  },
  {
    id: "4",
    platform: "Google",
    rating: 5,
    author: "Olivia T.",
    text: "Second time here and won't go anywhere else. Love the results and the whole team is so welcoming!",
    date: "2 weeks ago",
    replied: true,
  },
  {
    id: "5",
    platform: "Google",
    rating: 3,
    author: "Mia R.",
    text: "Good results but had to wait 20 minutes past my appointment time. Would appreciate better time management.",
    date: "3 weeks ago",
    replied: true,
  },
] as const;
