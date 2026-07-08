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
  title: "Clinic Grower Internal CRM | Sales and Delivery Operations",
  description:
    "Internal Clinic Grower CRM for prospects, client accounts, delivery tasks, and team operations.",
  keywords: [
    "Clinic Grower internal CRM",
    "sales pipeline",
    "client account management",
    "delivery operations",
    "team task management",
  ],
  openGraph: {
    title: "Clinic Grower Internal CRM",
    description:
      "Manage Clinic Grower prospects, client accounts, internal tasks, and delivery operations.",
    type: "website",
    locale: "en_GB",
    siteName: "Clinic Grower Internal CRM",
  },
  twitter: {
    card: "summary_large_image",
    title: "Clinic Grower Internal CRM",
    description:
      "Internal sales and delivery operations for the Clinic Grower team.",
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
