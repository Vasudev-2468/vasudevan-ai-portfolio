import type { Metadata } from "next";
import Script from "next/script";
import { Instrument_Serif, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import ThemeProvider from "@/components/ThemeProvider";

const space = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

const instrument = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://vasudevan.ai";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Vasudevan.ai — Research · Innovation · Intelligent Systems",
    template: "%s · Vasudevan.ai",
  },
  description:
    "Personal AI portfolio of Vasudevan Sundaramurthy — PhD researcher in Mathematics with Data Science, computer vision engineer, and full-stack ML builder. Talk to an AI avatar grounded in the real portfolio.",
  keywords: [
    "Vasudevan Sundaramurthy",
    "AI portfolio",
    "computer vision",
    "PhD Mathematics Data Science",
    "deep learning",
    "gastrointestinal image classification",
    "AI avatar",
    "RAG",
  ],
  authors: [{ name: "Vasudevan Sundaramurthy" }],
  creator: "Vasudevan Sundaramurthy",
  alternates: { canonical: "/" },
  openGraph: {
    title: "Vasudevan.ai — AI Portfolio + Interactive AI Avatar",
    description:
      "Computer vision research, ML engineering, and a talking AI avatar grounded in the resume.",
    type: "website",
    url: SITE_URL,
    siteName: "Vasudevan.ai",
    images: [
      {
        url: "/images/avatar.png",
        width: 1200,
        height: 630,
        alt: "Vasudevan Sundaramurthy — AI portfolio",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vasudevan.ai — AI Portfolio + Interactive AI Avatar",
    description:
      "Computer vision research, ML engineering, and a talking AI avatar grounded in the resume.",
    images: ["/images/avatar.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/images/avatar.png" }],
  },
  manifest: "/manifest.webmanifest",
};

// Boot: honor stored preference; default to the premium dark AI theme.
const themeBootstrap = `(function(){try{var t=localStorage.getItem('vasudevan-theme');if(t!=='white'&&t!=='rgb'&&t!=='black')t='black';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','black');}})();`;

const personSchema = {
  "@context": "https://schema.org",
  "@type": "Person",
  name: "Vasudevan Sundaramurthy",
  url: SITE_URL,
  image: `${SITE_URL}/images/avatar.png`,
  jobTitle: "AI Researcher · Computer Vision Engineer · PhD Scholar",
  description:
    "PhD scholar in Mathematics with Data Science. Computer vision, gastrointestinal image classification, and full-stack ML systems.",
  sameAs: [
    // Filled in from Profile.links at run time on the client if needed;
    // static defaults here are safe to omit until confirmed.
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="black"
      className={`${space.variable} ${instrument.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
        <Script
          id="person-jsonld"
          type="application/ld+json"
          strategy="afterInteractive"
        >
          {JSON.stringify(personSchema)}
        </Script>
      </head>
      <body suppressHydrationWarning>
        {/* Skip link — hidden until keyboard-focused. Puts keyboard users
            straight into the main content without stepping through the
            entire nav on every page load. */}
        <a
          href="#top"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-ink-950 focus:shadow-lg"
        >
          Skip to content
        </a>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
