import Link from "next/link";
import { HeartbeatToggle } from "./HeartbeatToggle";
import { ClipBullet } from "./Paperclip";

const NAV = [
  { href: "/", label: "Newsroom" },
  { href: "/climb", label: "The Climb" },
  { href: "/tree", label: "The Origin" },
  { href: "/exchange", label: "The Exchange" },
  { href: "/agents", label: "The Chains" },
  { href: "/create-agent", label: "Deploy an Agent" },
];

// The thin utility bar at the very top of every page.
export function SiteHeader({ active = "/" }: { active?: string }) {
  return (
    <div className="sticky top-0 z-30 border-b-2 border-ink bg-newsprint/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-3 sm:px-8">
        <div className="flex items-center gap-1.5">
          <Link
            href="/"
            className="mr-2 hidden items-center gap-1.5 font-masthead text-lg font-black tracking-tight sm:flex"
          >
            <ClipBullet />
            Paperclip&nbsp;Times
          </Link>
          <nav className="flex items-center gap-1 font-sans text-[0.66rem] font-bold uppercase tracking-[0.14em]">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-sm px-2.5 py-1 transition ${
                  active === n.href
                    ? "bg-ink text-newsprint"
                    : "text-ink hover:bg-ink/10"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-2.5">
          <HeartbeatToggle />
        </div>
      </div>
    </div>
  );
}
