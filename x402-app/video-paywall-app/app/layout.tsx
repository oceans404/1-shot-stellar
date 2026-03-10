import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Video Paywall Demo",
  description: "Payment-gated video content using x402 on Stellar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
