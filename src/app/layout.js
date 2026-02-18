import "./globals.css";
import localFont from "next/font/local";
import { DarkModeProvider } from "@/contexts/DarkModeContext";

const PPNeueYorkNarrowMedium = localFont({
  src: '../fonts/PPNeueYork-NarrowMedium.woff',
  display: 'swap',
});

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover', // ← clave para safe-area-inset en Android
};

export const metadata = {
  title: "Kiko Climent",
  description: "Frontend Developer Portfolio",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={PPNeueYorkNarrowMedium.className}>
      <body
        className={`${PPNeueYorkNarrowMedium.className} antialiased`}
      >
        <DarkModeProvider>
          {children}
        </DarkModeProvider>
      </body>
    </html>
  );
}
