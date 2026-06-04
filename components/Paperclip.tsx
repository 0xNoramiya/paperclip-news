// The brand motif: one red paperclip. Used as masthead emblem, section bullet,
// and divider. Stroke-only so it reads at any size.
export function Paperclip({
  className = "",
  size = 24,
  strokeWidth = 2.4,
}: {
  className?: string;
  size?: number;
  strokeWidth?: number;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {/* A classic gem paperclip: outer loop + inner return */}
      <path d="M8 7.5v8.2a3.2 3.2 0 0 0 6.4 0V6.2a5 5 0 0 0-10 0v9.6a6.8 6.8 0 0 0 13.6 0V7.5" />
    </svg>
  );
}

// A tiny inline red paperclip bullet for lists / section heads.
export function ClipBullet({ className = "" }: { className?: string }) {
  return (
    <Paperclip
      size={14}
      strokeWidth={2.6}
      className={`inline-block -rotate-12 text-paperclipRed ${className}`}
    />
  );
}
