import "./globals.css";
import localFont from "next/font/local";
import { DarkModeProvider } from "@/contexts/DarkModeContext";

const PPNeueMontreal = localFont({
  src: '../fonts/PPNeueMontreal-Medium.woff',
  display: 'swap',
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // ← clave para safe-area-inset en Android
};

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.kcliment.dev";

const siteDescription =
  "Frontend developer and creative coder crafting immersive digital experiences with motion, interaction, and 3D. Portfolio featuring selected web projects built with Next.js, GSAP, Three.js, and WebGL.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Kiko Climent — Frontend Developer & Creative Coder",
    template: "%s | Kiko Climent",
  },
  description: siteDescription,
  keywords: [
    "Kiko Climent",
    "frontend developer",
    "creative coder",
    "web developer portfolio",
    "Next.js",
    "GSAP",
    "Three.js",
    "WebGL",
    "motion design",
    "interactive web",
  ],
  authors: [{ name: "Kiko Climent", url: siteUrl }],
  creator: "Kiko Climent",
  publisher: "Kiko Climent",
  robots: {
    index: true,
    follow: true,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Kiko Climent",
    title: "Kiko Climent — Frontend Developer & Creative Coder",
    description: siteDescription,
  },
  twitter: {
    card: "summary",
    title: "Kiko Climent — Frontend Developer & Creative Coder",
    description: siteDescription,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={PPNeueMontreal.className}>
      <body
        className={`${PPNeueMontreal.className} antialiased`}
      >
        <DarkModeProvider>
          {children}
        </DarkModeProvider>
      </body>
    </html>
  );
}
