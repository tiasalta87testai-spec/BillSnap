'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Camera, History, BarChart3, ShieldCheck } from 'lucide-react';
import styles from './BottomNav.module.css';

export default function BottomNav() {
  const pathname = usePathname();

  const isHome = pathname === '/' || pathname === '/review';
  const isHistory = pathname.startsWith('/history') || pathname.startsWith('/receipt');
  const isStats = pathname.startsWith('/stats');
  const isAdmin = pathname.startsWith('/admin');

  return (
    <nav className={styles.nav} aria-label="Navigazione principale">
      <Link
        href="/"
        className={`${styles.item} ${isHome ? styles.active : ''}`}
        aria-current={isHome ? 'page' : undefined}
      >
        <Camera size={22} strokeWidth={2} />
        <span>Acquisisci</span>
      </Link>
      <Link
        href="/history"
        className={`${styles.item} ${isHistory ? styles.active : ''}`}
        aria-current={isHistory ? 'page' : undefined}
      >
        <History size={22} strokeWidth={2} />
        <span>Storico</span>
      </Link>
      <Link
        href="/stats"
        className={`${styles.item} ${isStats ? styles.active : ''}`}
        aria-current={isStats ? 'page' : undefined}
      >
        <BarChart3 size={22} strokeWidth={2} />
        <span>Statistiche</span>
      </Link>
      <Link
        href="/admin"
        className={`${styles.item} ${isAdmin ? styles.active : ''}`}
        aria-current={isAdmin ? 'page' : undefined}
      >
        <ShieldCheck size={22} strokeWidth={2} />
        <span>Admin</span>
      </Link>
    </nav>
  );
}
