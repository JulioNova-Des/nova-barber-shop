import { useNavigate } from "react-router-dom";

export default function TopNav({ title, subtitle, onBack, showHome = true, rightContent }) {
  const nav = useNavigate();
  return (
    <div className="sticky top-0 z-10 border-b border-white/10 bg-nova-bg-main/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-5 py-2.5">
        {onBack && (
          <button onClick={onBack} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 text-nova-offwhite/60 hover:border-nova-gold/40 hover:text-nova-gold-light">←</button>
        )}
        {showHome && (
          <button onClick={() => nav("/")} className="shrink-0">
            <img src="/logo-nova.jpg" alt="NOVA" className="h-7 w-7 rounded-full border border-nova-gold/30 object-cover" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="font-display text-sm font-bold truncate">{title}</div>
          {subtitle && <div className="font-sans text-[11px] text-nova-offwhite/50 truncate">{subtitle}</div>}
        </div>
        {rightContent}
      </div>
    </div>
  );
}
