import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "YouTube Paywall",
  description: "Pay-per-view YouTube video using x402 on Stellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
