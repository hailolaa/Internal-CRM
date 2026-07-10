import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { GsapSiteEffects } from "@/components/motion/gsap-site-effects";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "ClinicGrower Mission Control | Internal Operations",
  description:
    "ClinicGrower Mission Control for internal sales, client accounts, delivery tasks, and team operations.",
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
      "Manage ClinicGrower prospects, client accounts, internal tasks, and delivery operations.",
    type: "website",
    locale: "en_GB",
    siteName: "ClinicGrower Mission Control",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClinicGrower Mission Control",
    description:
      "Internal sales and delivery operations for the ClinicGrower team.",
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
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} antialiased`}>
        {children}
        <GsapSiteEffects />
      </body>
    </html>
  );
}
