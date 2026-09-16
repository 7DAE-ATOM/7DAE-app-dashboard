import type { Metadata } from "next";
import Header from "@/components/Header";
import Providers from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Airbus Applications Catalog",
  description: "Visual catalog of Airbus applications",
};

const themeInitScript = `(function(){try{var t=localStorage.getItem('theme');if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

// Catalogue grid density (see lib/catalogueDensity.ts). Applied before the
// first paint for the same reason as the theme: the grid template reads
// `--cat-cols`, so a value restored after hydration would repaint the whole
// catalogue. Keep the allowed values in sync with COLUMN_OPTIONS/ROW_OPTIONS.
const densityInitScript = `(function(){var c=3,r=4;try{var s=JSON.parse(localStorage.getItem('catalogue-density'));if(s){if([3,5,8].indexOf(s.columns)>=0)c=s.columns;if(s.rows==='all'||(Number.isInteger(s.rows)&&s.rows>=1&&s.rows<=10))r=s.rows;}}catch(e){}var d=document.documentElement;d.setAttribute('data-cat-cols',String(c));d.setAttribute('data-cat-rows',String(r));d.style.setProperty('--cat-cols',String(c));})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-cat-cols="3"
      data-cat-rows="4"
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script dangerouslySetInnerHTML={{ __html: densityInitScript }} />
      </head>
      <body className="theme-industrial-premium">
        <Providers>
          <Header />
          {children}
        </Providers>
      </body>
    </html>
  );
}
