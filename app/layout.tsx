import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "react-hot-toast";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { auth } from "@/lib/auth";

// Force dynamic rendering untuk semua routes
export const dynamic = "force-dynamic";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Closing Report LM JTT08",
  description: "Sistem Closing Harian & Productivity Last Mile JTT08",
  icons: {
    icon: "/logo-jtt08.png",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="id" className={`${geist.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("jtt08_theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col text-slate-900">
        <SessionProvider
          session={session}
          refetchInterval={5 * 60}
          refetchOnWindowFocus={true}
        >
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                borderRadius: "12px",
                background: "#0f172a",
                color: "#f8fafc",
                boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.25)",
              },
            }}
          />
          {session && <Navbar />}
          <main className="flex-1">{children}</main>
          {session && <Footer />}
        </SessionProvider>
      </body>
    </html>
  );
}
