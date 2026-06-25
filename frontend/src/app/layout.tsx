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

export const metadata: Metadata = {
  title: "Vasudevan.ai — Research · Innovation · Intelligent Systems",
  description:
    "Personal AI portfolio of Vasudevan Sundaramurthy — PhD researcher in Mathematics with Data Science, computer vision engineer, and full-stack ML builder.",
  openGraph: {
    title: "Vasudevan.ai",
    description: "Research, innovation, and intelligent systems.",
    type: "website",
  },
};

const themeBootstrap = `document.documentElement.setAttribute('data-theme','white');`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="white"
      className={`${space.variable} ${instrument.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <Script id="theme-bootstrap" strategy="beforeInteractive">
          {themeBootstrap}
        </Script>
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
