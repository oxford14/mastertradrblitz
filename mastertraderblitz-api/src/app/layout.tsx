import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'MasterTraderBlitz Dashboard',
  description: 'AI-powered trading decision platform',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="layout">
          <aside className="sidebar">
            <h1>MasterTraderBlitz</h1>
            <nav>
              <Link href="/">Dashboard</Link>
              <Link href="/decisions">AI Decisions</Link>
              <Link href="/history">Trade History</Link>
              <Link href="/analytics">Analytics</Link>
              <Link href="/strategies">Strategies</Link>
              <Link href="/settings">AI Settings</Link>
            </nav>
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
