import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cepti – Digital Solutions for Modern Business",
  description:
    "Cepti helps businesses grow with web development, digital strategy, mobile apps, cloud services, and IT consulting.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
