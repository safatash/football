// Line icons used across NVASA (24px grid, 2px stroke). Rendered inline so they inherit currentColor.
const PATHS = {
  home: `<path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/>`,
  users: `<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.6 3.3-5.5 6.5-5.5s5.9 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 010 6.8M18 14.8c2 .7 3.2 2.4 3.5 5.2"/>`,
  cal: `<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>`,
  clip: `<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 10h7M8.5 14h7M8.5 18h4"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.2 4-6.5 8-6.5s7.2 2.3 8 6.5"/>`,
  pin: `<path d="M12 21s7-6.2 7-11.5A7 7 0 005 9.5C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>`,
  clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  check: `<path d="M5 12.5l4.5 4.5L19 7.5"/>`,
  x: `<path d="M6 6l12 12M18 6L6 18"/>`,
  alert: `<path d="M12 3.5l9.5 16.5h-19z"/><path d="M12 10v4.5M12 17.5v.5"/>`,
  info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.5v.5"/>`,
  right: `<path d="M9 5l7 7-7 7"/>`,
  left: `<path d="M15 5l-7 7 7 7"/>`,
  down: `<path d="M5 9l7 7 7-7"/>`,
  print: `<path d="M6.5 9V3.5h11V9"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6.5 14.5h11V21h-11z"/>`,
  ticket: `<path d="M3 8.5V6h18v2.5a2.5 2.5 0 000 5V18H3v-2.5a2.5 2.5 0 000-5z" transform="translate(0 -.5)"/><path d="M14 6v12" stroke-dasharray="2 2.5"/>`,
  shield: `<path d="M12 3l8 3v6c0 4.6-3.4 8-8 9-4.6-1-8-4.4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>`,
  search: `<circle cx="11" cy="11" r="7"/><path d="M20.5 20.5L16 16"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  send: `<path d="M21 3L10 14M21 3l-7 18-4-7-7-4z"/>`,
  lock: `<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 018 0v3"/>`,
  trophy: `<path d="M8 4h8v5a4 4 0 01-8 0z"/><path d="M8 6H4.5c0 3 1.5 4.5 3.7 4.8M16 6h3.5c0 3-1.5 4.5-3.7 4.8M12 13v4M8.5 20.5h7M10 17h4v3.5h-4z"/>`,
  gear: `<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z"/>`,
  list: `<path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/>`,
  grid: `<rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/>`,
  out: `<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>`,
  mail: `<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 6.5L12 13l8.5-6.5"/>`,
  edit: `<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>`,
  ball: `<circle cx="12" cy="12" r="9"/><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z"/><path d="M12 3v4.5M16 10.4l4.2-1.6M14.5 15.1l2.4 4.1M9.5 15.1l-2.4 4.1M8 10.4L3.8 8.8"/>`,
  pitch: `<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 12h18"/><circle cx="12" cy="12" r="2.8"/><path d="M8.5 4v3h7V4M8.5 20v-3h7v3"/>`,
  whistle: `<circle cx="9" cy="14" r="5"/><path d="M12 10l9-3v4l-7 2.5"/><circle cx="9" cy="14" r="1"/>`,
  flag: `<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>`,
  dl: `<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>`,
  swap: `<path d="M7 7h12l-3-3M17 17H5l3 3"/>`,
  dots: `<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>`,
  wait: `<path d="M7 3h10M7 21h10M8 3c0 5 8 5 8 9s-8 4-8 9M16 3c0 5-8 5-8 9"/>`,
  star: `<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8 6.8 19.6l1-5.8-4.3-4.1 5.9-.8z"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>`,
  card: `<rect x="3" y="5.5" width="18" height="13" rx="2"/><path d="M3 10h18M7 15h3"/>`,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, className = "size-[18px]", label }: { name: IconName; className?: string; label?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`shrink-0 fill-none stroke-current ${className}`}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
