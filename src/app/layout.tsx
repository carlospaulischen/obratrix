import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Obratrix | Gestão de obras",
    template: "%s | Obratrix",
  },
  description: "Planejamento, execução e custos de obras em um só lugar.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Obratrix" },
};

export const viewport: Viewport = {
  themeColor: "#126747",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const messages = await getMessages();

  return (
    <html lang="pt-BR">
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
