import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Portlander",
  description: "A calendar for your portfolio holdings",
};

const NAV_LINKS = [
  { href: "/", label: "Holdings" },
  { href: "/calendar", label: "Calendar" },
  { href: "/import", label: "Import" },
  { href: "/settings", label: "Settings" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="mx-auto max-w-4xl px-4 py-6">
          <header className="mb-8 flex items-center justify-between">
            <Link href="/" className="text-lg font-semibold">
              Portlander
            </Link>
            <nav className="flex gap-4 text-sm">
              {NAV_LINKS.map((link) => (
                <Link key={link.href} href={link.href} className="text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100">
                  {link.label}
                </Link>
              ))}
            </nav>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
