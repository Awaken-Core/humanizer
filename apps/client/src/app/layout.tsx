import type { Metadata } from "next";
import { Geist } from "next/font/google";
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
        "font-sans",
      )}
      suppressHydrationWarning
    >
      <head>
        <script
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
      </head>
      <body
        className="bg-background font-sans text-foreground antialiased"
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
