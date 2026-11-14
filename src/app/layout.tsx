import "~/styles/globals.css";

import type { Metadata } from "next";
import { Inter } from "next/font/google";

import { ThemeProvider } from "~/components/shell/theme-provider";
import { Toaster } from "~/components/ui/sonner";
import { TooltipProvider } from "~/components/ui/tooltip";
import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: { default: "finbro", template: "%s · finbro" },
  description: "Personal investment and expense tracker.",
  robots: { index: false, follow: false },
};

// Variable font: the design uses the in-between weights 360, 420 and 480.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  axes: ["opsz"],
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <TRPCReactProvider>
            <TooltipProvider>{children}</TooltipProvider>
            <Toaster position="bottom-right" />
          </TRPCReactProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
