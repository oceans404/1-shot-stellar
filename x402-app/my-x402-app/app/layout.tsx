import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "x402 TADA Demo",
  description: "Payment-gated content using x402 on Stellar",
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
