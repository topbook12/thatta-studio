import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import PwaRegister from "@/components/pwa-register";

export const metadata: Metadata = {
  title: "ঠাট্টা স্টুডিও — বাংলা কার্টুন বানানোর প্ল্যাটফর্ম",
  description:
    "গোপাল ভাঁড় স্টাইলের মজার বাংলা কার্টুন সহজে বানান: ক্যারেক্টর তৈরি করুন, দৃশ্য সাজান, বাংলা ভয়েস যোগ করুন আর ভিডিও এক্সপোর্ট করুন — সব এক জায়গায়।",
  keywords: ["বাংলা কার্টুন", "কার্টুন বানানো", "animation", "gopal bhar", "thatta studio"],
  manifest: "/manifest.webmanifest",
  applicationName: "ঠাট্টা স্টুডিও",
  appleWebApp: {
    capable: true,
    title: "ঠাট্টা স্টুডিও",
    statusBarStyle: "default",
  },
  formatDetection: { telephone: false },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="bn" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Hind+Siliguri:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Toaster />
        <PwaRegister />
      </body>
    </html>
  );
}
