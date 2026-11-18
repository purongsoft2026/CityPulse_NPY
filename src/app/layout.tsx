import type { Metadata, Viewport } from "next";
import { Outfit, Prompt } from "next/font/google";
import { PwaInstallProvider } from "@/components/pwa/PwaInstallProvider";
import "./globals.css";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

export const metadata: Metadata = {
  applicationName: "CityPulse",
  title: "CityPulse | แผนที่แจ้งเหตุอัจฉริยะ & ศูนย์พลเมืองตื่นรู้",
  description:
    "ระบบแผนที่แจ้งเหตุและติดตามคุณภาพเมือง 77 จังหวัด พร้อมศูนย์พลเมืองตื่นรู้และศูนย์ปฏิบัติการเจ้าหน้าที่",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CityPulse",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning className={`${outfit.variable} ${prompt.variable} min-h-full antialiased`}>
      <head>
        <meta name="color-scheme" content="light dark" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('complaint-map-theme');
                var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (theme === 'dark' || (!theme && prefersDark)) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
        {/* JK Icons (Font Awesome Pro v7.3.0) from /public/lib/jk/iocn */}
        <link rel="stylesheet" href="/lib/jk/iocn/releases/v7.3.0/css/fontawesome.css" />
        <link rel="stylesheet" href="/lib/jk/iocn/releases/v7.3.0/css/solid.css" />
        <link rel="stylesheet" href="/lib/jk/iocn/releases/v7.3.0/css/regular.css" />
        <link rel="stylesheet" href="/lib/jk/iocn/releases/v7.3.0/css/light.css" />
        <link rel="stylesheet" href="/lib/jk/iocn/releases/v7.3.0/css/duotone.css" />
        <link rel="stylesheet" href="/lib/jk/iocn/releases/v7.3.0/css/sharp-solid.css" />
        <link rel="stylesheet" href="/lib/jk/iocn/releases/v7.3.0/css/sharp-regular.css" />
        <link rel="stylesheet" href="/lib/jk/iocn/releases/v7.3.0/css/brands.css" />
      </head>
      <body className="min-h-dvh w-full font-sans antialiased">
        {children}
        <PwaInstallProvider />
      </body>
    </html>
  );
}
