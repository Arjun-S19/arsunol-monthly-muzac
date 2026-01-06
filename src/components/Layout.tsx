import type { ReactNode } from 'react';
import Footer from './Footer';

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout-shell">
      <main className="page" id="app-shell">
        <div className="card">
          {children}
          <Footer />
        </div>
      </main>
    </div>
  );
}
