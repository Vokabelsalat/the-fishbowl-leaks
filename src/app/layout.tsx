import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { StoreProvider } from "@/store/StoreProvider";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "The Fishbowl Leaks — After Augmented Reality",
  description: "Scan the exhibition, grow an unclassifiable sea creature, and release it into the shared aquarium.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#031015",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
