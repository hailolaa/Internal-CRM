import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { GsapSiteEffects } from "@/components/motion/gsap-site-effects";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "ClinicGrower Mission Control | Internal CRM",
  description:
    "ClinicGrower Mission Control internal CRM for sales, proposals, client delivery, onboarding, follow-up, and team operations.",
  keywords: [
    "ClinicGrower Mission Control",
    "sales pipeline",
    "client account management",
    "delivery operations",
    "team task management",
  ],
  openGraph: {
    title: "ClinicGrower Mission Control",
    description:
      "Manage ClinicGrower prospects, proposals, client accounts, tasks, onboarding, and daily CRM operations.",
    type: "website",
    locale: "en_GB",
    siteName: "ClinicGrower Mission Control",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClinicGrower Mission Control",
    description:
      "Internal CRM for ClinicGrower sales, delivery, onboarding, and follow-up.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${plusJakarta.variable}`}>
      <body className={`${inter.className} antialiased`}>
        {children}
        <GsapSiteEffects />
      </body>
    </html>
  );
}
