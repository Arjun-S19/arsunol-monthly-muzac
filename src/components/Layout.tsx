import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import Footer from './Footer';

type LayoutProps = {
  children: ReactNode;
};

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation();
  const isTagMap = pathname.startsWith('/tags');
  const shellClass = isTagMap ? 'layout-shell layout-shell-wide' : 'layout-shell';
  const mainClass = isTagMap ? 'page page-wide' : 'page';

  return (
    <div className={shellClass}>
      <div className="bg-soften" aria-hidden="true" />
      <main className={mainClass} id="app-shell">
        {children}
        <Footer />
      </main>
    </div>
  );
}
