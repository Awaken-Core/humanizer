import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Script from "next/script";
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

export const metadata: Metadata = {
  metadataBase: new URL(env.NEXT_PUBLIC_APP_BASE_URL),
  title: {
    default: "Humanizer | Free AI Text Humanizer & Writing Assistant",
    template: "%s | Humanizer",
  },
  description:
    "Transform AI-generated drafts into natural, human-sounding writing. 100% free AI humanizer, AI detector, paraphraser, summarizer, and grammar assistant without paywalls.",
  keywords: [
    "AI humanizer",
    "humanize AI text",
    "AI content detector",
    "bypassing AI detection",
    "free paraphraser",
    "undetectable AI free alternative",
    "QuillBot alternative",
    "academic writing assistant",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Humanizer | Free AI Text Humanizer & Writing Assistant",
    description:
      "Transform AI-generated drafts into natural, human-sounding writing. Free AI humanizer, detector, and writing assistant.",
    url: "/",
    siteName: "Humanizer",
    type: "website",
    images: [
      {
        url: "/image/logo.svg",
        width: 512,
        height: 512,
        alt: "Humanizer Logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Humanizer | Free AI Text Humanizer & Writing Assistant",
    description:
      "Transform AI-generated drafts into natural, human-sounding writing. Free writing suite.",
    images: ["/image/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${env.NEXT_PUBLIC_APP_BASE_URL}#website`,
        url: env.NEXT_PUBLIC_APP_BASE_URL,
        name: "Humanizer",
        description:
          "Make AI-generated text sound natural and human with zero paywalls.",
        inLanguage: "en-US",
      },
      {
        "@type": "Organization",
        "@id": `${env.NEXT_PUBLIC_APP_BASE_URL}#organization`,
        name: "Humanizer",
        url: env.NEXT_PUBLIC_APP_BASE_URL,
        logo: `${env.NEXT_PUBLIC_APP_BASE_URL}/image/logo.svg`,
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${env.NEXT_PUBLIC_APP_BASE_URL}#software`,
        name: "Humanizer",
        applicationCategory: "WritingAssistantApplication",
        operatingSystem: "All",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        description:
          "Free AI text humanizer, AI detector, and writing studio to naturalize AI-generated text without paywalls.",
      },
    ],
  };

  return (
    <html
      lang="en"
      className={cn(geistSans.variable, "font-sans")}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="bg-background font-sans text-foreground antialiased"
        suppressHydrationWarning
      >
        <Script
          id="bis-skin-cleanup"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  if (typeof Element !== 'undefined') {
                    var origSet = Element.prototype.setAttribute;
                    Element.prototype.setAttribute = function(name, val) {
                      if (name === 'bis_skin_checked') return;
                      return origSet.apply(this, arguments);
                    };
                  }
                  if (typeof document !== 'undefined') {
                    var clean = function() {
                      var els = document.querySelectorAll('[bis_skin_checked]');
                      for (var i = 0; i < els.length; i++) {
                        els[i].removeAttribute('bis_skin_checked');
                      }
                    };
                    document.addEventListener('DOMContentLoaded', clean, { once: true });
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
        <Providers>{children}</Providers>
        {env.NEXT_PUBLIC_GA_MEASUREMENT_ID && (
          <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
        )}
      </body>
    </html>
  );
}
