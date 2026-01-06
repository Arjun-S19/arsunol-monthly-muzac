import type { ReactNode } from 'react';
import Footer from './Footer';

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout-shell">
      <div className="bg-soften" aria-hidden="true" />
      <main className="page" id="app-shell">
        {children}
        <Footer />
      </main>
    </div>
  );
}
