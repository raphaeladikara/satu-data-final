import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';
import { AppHeader, AppShell, PageHead } from './AppShell';
import { BrandMark } from './BrandMark';

/** Bilah atas ruang latihan; slot untuk info kasus. */
export function TopBar({ children, onHelp }: { children?: ReactNode; onHelp?: () => void }) {
  return <AppHeader compact slot={children} onHelp={onHelp} />;
}

export function Logo() {
  return <BrandMark className="size-7" />;
}

/**
 * Halaman standar bertema terang. Isi halaman lama ditaruh di dalam .legacy supaya
 * kelas lamanya (card, btn, table) tetap berlaku dengan token warna terang.
 */
export function Page({ title, sub, actions, children, wide, eyebrow, onHelp }: { title?: ReactNode; sub?: ReactNode; actions?: ReactNode; children: ReactNode; wide?: boolean; eyebrow?: ReactNode; onHelp?: () => void }) {
  return (
    <AppShell wide={wide} onHelp={onHelp}>
      {(title || actions) && <PageHead eyebrow={eyebrow} title={title} sub={sub} actions={actions} />}
      <div className="legacy grid min-w-0 gap-4">{children}</div>
    </AppShell>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="tw flex flex-col items-center gap-2 rounded-2xl border border-dashed border-ink/15 !bg-transparent px-6 py-8 text-center">
      <span className="grid size-11 place-items-center rounded-2xl bg-mint text-teal">
        <Inbox className="size-5" />
      </span>
      <b className="text-[15px] font-medium">{title}</b>
      {children && <div className="max-w-sm text-[13.5px] text-ink/55">{children}</div>}
    </div>
  );
}

export function Loading({ text = 'Memuat…' }: { text?: string }) {
  return (
    <div className="tw flex items-center gap-3 !bg-transparent py-6 text-[14px] text-ink/55">
      <span className="size-5 animate-[spin_0.7s_linear_infinite] rounded-full border-2 border-teal/20 border-t-teal" />
      {text}
    </div>
  );
}
