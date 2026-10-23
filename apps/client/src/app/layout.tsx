import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@next/third-parties/google";

import Providers from "@/components/provider";
import { env } from "@/lib/env";
import { cn } from "@/lib/utils";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_BASE_URL),
  title: {
    default: "Humanizer",
    template: "%s | Humanizer",
  },
  description: "Make AI-generated text sound more natural and human.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Humanizer",
    description: "Make AI-generated text sound more natural and human.",
    url: "/",
    siteName: "Humanizer",
    type: "website",
    images: [
      {
        url: "/image/logo.png",
        width: 512,
        height: 512,
        alt: "Humanizer",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Humanizer",
    description: "Make AI-generated text sound more natural and human.",
    images: ["/image/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn(
        geistSans.variable,
        geistMono.variable,
        "font-sans",
      )}
      suppressHydrationWarning
    >
      <body
        className="bg-[#080808] font-sans text-[#F5F5F5] antialiased"
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        {env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
