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
  title: "The Growth Group Internal CRM | Sales and Delivery Operations",
  description:
    "Internal The Growth Group CRM for prospects, client accounts, delivery tasks, and team operations.",
  keywords: [
    "The Growth Group internal CRM",
    "sales pipeline",
    "client account management",
    "delivery operations",
    "team task management",
  ],
  openGraph: {
    title: "The Growth Group Internal CRM",
    description:
      "Manage The Growth Group prospects, client accounts, internal tasks, and delivery operations.",
    type: "website",
    locale: "en_GB",
    siteName: "The Growth Group Internal CRM",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Growth Group Internal CRM",
    description:
      "Internal sales and delivery operations for The Growth Group team.",
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
