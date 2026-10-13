export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#d97706" />
      <circle cx="32" cy="22" r="8" fill="#fff" />
      <g stroke="#fff" strokeWidth="3" strokeLinecap="round">
        <path d="M32 6v4M18 12l3 3M46 12l-3 3M12 24h4M48 24h4" />
      </g>
      <path d="M12 52l6-16h28l6 16z" fill="#fff" />
      <path d="M22 36l-2 16M32 36v16M42 36l2 16M15 44h34" stroke="#d97706" strokeWidth="2" />
    </svg>
  );
}
