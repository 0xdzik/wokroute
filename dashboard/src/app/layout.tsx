import { AnimatePresence, m } from "framer-motion";
import {
  Activity,
  Bell,
  Boxes,
  Cable,
  ChartSpline,
  Check,
  ChevronsLeft,
  ChevronsRight,
  Clock,
  Coins,
  Database,
  Filter,
  Gauge,
  Globe,
  LayoutDashboard,
  Layers,
  LogOut,
  Menu,
  MessageSquare,
  Moon,
  Pencil,
  Search,
  Settings,
  SlidersHorizontal,
  Sun,
  Terminal,
  TerminalSquare,
  Timer,
  Workflow,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { NavLink, useLocation, useNavigate, useOutlet } from "react-router-dom";
import { useTheme } from "next-themes";
import { cn } from "../lib/cn";
import { detectMotionProfile, getPageTransition, getPopoverMotion, MOTION_OVERRIDE_EVENT, useMotionProfile, type MotionProfile } from "../lib/motion";
import { apiGet, apiPost } from "../lib/api";
import { qk } from "../lib/query-keys";
import { formatUptime } from "../lib/format";
import { toast } from "../lib/toast";
import { Dialog } from "../components/ui/dialog";
import { Input } from "../components/ui/input";

interface HealthStatus {
  version: string;
  startedAt: number;
  uptimeSeconds: number;
  now: number;
  timezoneOffsetMinutes: number;
}

interface AppearanceSettingsResponse {
  settings: {
    runtime: {
      sidebarIconDataUrl: string | null;
    };
  };
}

const GITHUB_REPO = "0xdzik/wokroute";

// ---------------------------------------------------------------------------
// StatusClock — header status pill (operational state + server clocks +
// uptime). Isolated so the 1-second tick never re-renders AppShell or any
// page inside <Outlet />.
// ---------------------------------------------------------------------------
function StatusClock({ statusData, isError }: { statusData: HealthStatus | undefined; isError: boolean }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const clockOffsetRef = useRef(0);
  const tzOffsetRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  useEffect(() => {
    if (!statusData) return;
    clockOffsetRef.current = statusData.now - Date.now();
    tzOffsetRef.current = statusData.timezoneOffsetMinutes;
    startedAtRef.current = statusData.startedAt;
  }, [statusData]);

  const serverNowMs = nowMs + clockOffsetRef.current;
  const serverLocalNow = new Date(serverNowMs - tzOffsetRef.current * 60_000);
  const liveUptimeSeconds = startedAtRef.current !== null
    ? (serverNowMs - startedAtRef.current) / 1000
    : null;

  return (
    <div className="flex shrink-0 items-center gap-3 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-3.5 py-2 text-[11px] text-[var(--text-2)] shadow-[var(--shadow-soft)]">
      <span className="flex items-center gap-1.5 font-semibold text-[var(--text-1)]">
        {isError ? (
          <>
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--red)]" />
            <span className="hidden lg:inline">System offline</span>
          </>
        ) : statusData ? (
          <>
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--green)]" />
            <span className="hidden lg:inline">All systems operational</span>
          </>
        ) : (
          <>
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--status-warning)]" />
            <span className="hidden lg:inline">Connecting…</span>
          </>
        )}
      </span>
      <span className="h-3.5 w-px bg-[var(--border-subtle)]" aria-hidden="true" />
      <span className="hidden items-center gap-1.5 tabular-nums md:flex" title="Server system time">
        <Clock size={12} className="shrink-0" />
        {serverLocalNow.toLocaleTimeString("en-GB", { timeZone: "UTC", hour12: false })}
      </span>
      <span className="hidden items-center gap-1.5 tabular-nums xl:flex" title="Uptime since server start">
        <Timer size={12} className="shrink-0" />
        {formatUptime(liveUptimeSeconds)}
      </span>
    </div>
  );
}

interface NavEntry {
  to: string;
  label: string;
  icon: typeof Boxes;
  badge?: string;
}

const NAV_GROUPS: { label: string; items: NavEntry[] }[] = [
  {
    label: "Main",
    items: [
      { to: "/overview", label: "Overview", icon: LayoutDashboard },
      { to: "/usage", label: "Usage", icon: ChartSpline },
      { to: "/providers", label: "Providers", icon: Cable },
      { to: "/model-studio", label: "Model Studio", icon: MessageSquare },
    ],
  },
  {
    label: "Control",
    items: [
      { to: "/combos", label: "Combos", icon: Layers },
      { to: "/quota", label: "Quota Management", icon: Gauge },
      { to: "/proxy-requests", label: "Proxy & Requests", icon: SlidersHorizontal },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/console-log", label: "Console Log", icon: Terminal },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const ADVANCED_NAV_GROUPS: { label: string; items: NavEntry[]; soon?: boolean }[] = [
  {
    label: "General",
    items: [
      { to: "/advanced", label: "Customization", icon: SlidersHorizontal },
      { to: "/advanced/filter-sanitize", label: "Filter Sanitize", icon: Filter },
      { to: "/advanced/token-saver", label: "Token Saver", icon: Coins },
      { to: "/advanced/cli-tools", label: "CLI Tools", icon: TerminalSquare },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/system-monitoring", label: "System Monitoring", icon: Activity },
      { to: "/advanced/db-map", label: "Database Map", icon: Database },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/multi-warp", label: "Multi Warp", icon: Globe },
      { to: "/advanced/automation", label: "Automation", icon: Workflow, badge: "Soon" },
    ],
  },
];

/**
 * `<Outlet />` re-renders reactively off router context the instant
 * `location` changes, which fights a key-based AnimatePresence: the
 * *outgoing* m.div (still mounted, mid-exit) would swap to the *new*
 * route's content underneath its exit animation, leaving the freshly
 * navigated page stuck invisible at the exit's final opacity/scale until a
 * hard refresh. Freezing the resolved element in state (computed once per
 * mount, since the initializer only runs on first render) keeps the exiting
 * instance showing its own page while a separate, freshly keyed instance
 * renders the new one.
 */
function AnimatedOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  // Crossfade the next theme snapshot without repainting the full surface.
  // Without View Transitions (or with reduced motion) the theme swaps instantly.
  const swapTheme = () => {
    const next = dark ? "light" : "dark";
    const startViewTransition = document.startViewTransition?.bind(document);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const coarsePointer = window.matchMedia("(pointer: coarse)").matches;

    if (!startViewTransition || reduced || coarsePointer) {
      setTheme(next);
      return;
    }

    const root = document.documentElement;
    root.dataset.themeWipe = "on";

    const transition = startViewTransition(() => {
      setTheme(next);
    });
    void transition.finished.finally(() => {
      delete root.dataset.themeWipe;
    });
  };

  return (
    <button
      type="button"
      onClick={swapTheme}
      aria-label="Toggle theme"
      className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-2)] shadow-[var(--shadow-soft)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-90"
    >
      <span key={dark ? "sun" : "moon"} className="theme-icon-enter grid place-items-center">
        {dark ? <Sun size={17} /> : <Moon size={17} />}
      </span>
    </button>
  );
}

function NotificationsDialog({
  open,
  onClose,
  statusData,
  isHealthError,
  updateAvailable,
  latestTag,
}: {
  open: boolean;
  onClose: () => void;
  statusData: HealthStatus | undefined;
  isHealthError: boolean;
  updateAvailable: boolean;
  latestTag: string | undefined;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const popupMotion = getPopoverMotion(useMotionProfile());
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    const onClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onCloseRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onClickOutside, { capture: true });
    requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("button")?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onClickOutside, { capture: true });
      returnFocusRef.current?.focus();
    };
  }, [open]);
  return (
    <AnimatePresence>
      {open && (
        <m.div
          ref={panelRef}
          role="dialog"
          aria-modal="false"
          aria-label="Notifications"
          tabIndex={-1}
          className="absolute right-0 top-[calc(100%+12px)] z-50 max-h-[calc(100dvh-120px)] w-[min(360px,calc(100vw-2rem))] origin-top-right overflow-auto rounded-2xl border border-[var(--border-subtle)] bg-[var(--popover-bg)] p-2.5 sm:right-0 sm:w-[360px]"
          {...popupMotion}
        >
          <div className="flex items-center gap-2 px-2 pb-2.5 pt-1">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]">
              <Bell size={14} aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold">Notifications</span>
            <button type="button" onClick={onClose} aria-label="Close notifications" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-[var(--text-3)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]">
              Close
              <X size={13} aria-hidden="true" />
            </button>
          </div>
          <div className="divide-y divide-[var(--border-subtle)] text-sm">
            <div role="status" className="flex items-start gap-2.5 py-3 first:pt-0 last:pb-0">
              <span className={cn("mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full", isHealthError ? "bg-[var(--red-soft)] text-[var(--red)]" : statusData ? "bg-[var(--green-soft)] text-[var(--green)]" : "bg-[var(--orange-soft)] text-[var(--status-warning)]")}>
                <span className={cn("h-2 w-2 rounded-full", isHealthError ? "bg-[var(--red)]" : statusData ? "bg-[var(--green)]" : "animate-pulse bg-[var(--status-warning)]")} />
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-[var(--text-1)]">{isHealthError ? "System status unavailable" : statusData ? "All systems operational" : "Checking system status"}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-2)]">{isHealthError ? "The dashboard could not reach the local health endpoint." : "Live status from this Wokroute instance."}</p>
              </div>
            </div>
            {updateAvailable ? (
              <div className="rounded-[12px] bg-[var(--accent-soft)] p-3.5">
                <p className="font-semibold text-[var(--accent)]">Update available</p>
                <p className="mt-0.5 text-xs text-[var(--text-2)]">GitHub has {latestTag ? `v${latestTag}` : "a newer release"} available.</p>
              </div>
            ) : (
              <p className="px-1 py-2.5 text-center text-xs text-[var(--text-3)]">No new notifications.</p>
            )}
          </div>
        </m.div>
      )}
    </AnimatePresence>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const items = useMemo(() => NAV_GROUPS.flatMap((group) => group.items), []);
  const filtered = items.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()));

  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  return (
    <Dialog open={open} onClose={onClose} title="Command Palette">
      <Input
        autoFocus
        placeholder="Go to page…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && filtered[0]) {
            navigate(filtered[0].to);
            onClose();
          }
        }}
      />
      <div className="mt-3 flex flex-col gap-1">
        {filtered.map((item) => (
          <button
            key={item.to}
            type="button"
            onClick={() => {
              navigate(item.to);
              onClose();
            }}
            className="flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-sm text-[var(--text-2)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]"
          >
            <item.icon size={15} aria-hidden="true" />
            {item.label}
          </button>
        ))}
        {filtered.length === 0 && <p className="px-2 py-3 text-sm text-[var(--text-3)]">No matches.</p>}
      </div>
    </Dialog>
  );
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railCollapsed, setRailCollapsed] = useState(() => localStorage.getItem("wokroute.railCollapsed") === "1");
  const toggleRailCollapsed = () => {
    setRailCollapsed((collapsed) => {
      const next = !collapsed;
      localStorage.setItem("wokroute.railCollapsed", next ? "1" : "0");
      return next;
    });
  };
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [adminName, setAdminName] = useState(() => localStorage.getItem("wokroute.adminName") ?? "Admin");
  const [adminNameDraft, setAdminNameDraft] = useState(adminName);
  const [editingAdminName, setEditingAdminName] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [motionProfile, setMotionProfile] = useState<MotionProfile>(() => detectMotionProfile());
  // Which rail flyout is open: advanced features menu, profile card, or none.
  const [openPanel, setOpenPanel] = useState<null | "advanced" | "profile">(null);
  const asideRef = useRef<HTMLElement>(null);

  const fullPath = location.pathname.replace(/\/$/, "") || "/overview";

  useEffect(() => {
    const mediaQueries = [
      window.matchMedia("(max-width: 767px)"),
      window.matchMedia("(pointer: coarse)"),
      window.matchMedia("(prefers-reduced-motion: reduce)"),
    ];
    const update = () => {
      const nextProfile = detectMotionProfile();
      setMotionProfile(nextProfile);
      document.documentElement.dataset.motionProfile = nextProfile;
    };
    update();
    for (const media of mediaQueries) media.addEventListener("change", update);
    window.addEventListener(MOTION_OVERRIDE_EVENT, update);
    return () => {
      for (const media of mediaQueries) media.removeEventListener("change", update);
      window.removeEventListener(MOTION_OVERRIDE_EVENT, update);
    };
  }, []);

  const routeTransition = getPageTransition(motionProfile);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Navigating closes the mobile drawer and any open flyout.
  useEffect(() => {
    setDrawerOpen(false);
    setOpenPanel(null);
  }, [location.pathname]);

  // Outside click + Escape dismiss the open flyout. Both flyout panels live
  // inside the aside, so a single containment check covers trigger + panel.
  useEffect(() => {
    if (!openPanel) return;
    const onPointerDown = (e: PointerEvent) => {
      if (asideRef.current?.contains(e.target as Node)) return;
      setOpenPanel(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPanel(null);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openPanel]);

  useEffect(() => {
    if (!drawerOpen) return;
    toast.dismiss();
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const selector = "aside a, aside button, aside input";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawerOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = [...document.querySelectorAll<HTMLElement>(selector)].filter((element) => !element.hasAttribute("disabled"));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(selector)?.focus());
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      (previous ?? menuButtonRef.current)?.focus();
    };
  }, [drawerOpen]);

  // Server clock (not the browser's) drives "system time"; refetched
  // periodically and interpolated locally by the 1s `now` ticker above.
  const statusQuery = useQuery({
    queryKey: qk.health.status,
    queryFn: () => apiGet<HealthStatus>("/health/status"),
    refetchInterval: 30_000,
  });
  const appearanceQuery = useQuery({
    queryKey: qk.settings.all,
    queryFn: () => apiGet<AppearanceSettingsResponse>("/settings"),
    staleTime: 30_000,
  });
  const releaseQuery = useQuery({
    queryKey: qk.releases.githubLatest,
    queryFn: async () => {
      const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`);
      if (!res.ok) throw new Error(`GitHub API ${res.status}`);
      return (await res.json()) as { tag_name: string; html_url: string };
    },
    staleTime: 30 * 60_000,
    retry: false,
  });
  const localVersion = statusQuery.data?.version;
  const latestTag = releaseQuery.data?.tag_name?.replace(/^v/, "");
  const updateAvailable = Boolean(localVersion && latestTag && latestTag !== localVersion);

  const initials = useMemo(() => {
    const parts = adminName.trim().split(/\s+/).filter(Boolean);
    return (parts.map((part) => part[0]).slice(0, 2).join("") || "A").toUpperCase();
  }, [adminName]);

  const isFullBleed = fullPath === "/console-log" || fullPath === "/advanced/db-map";

  const sidebar = useMemo(() => (
        <aside
      ref={asideRef}
      className={cn(
        "sidebar-drawer flex h-full flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-1)] shadow-[var(--shadow-card)]",
        // Pinned to the viewport's left edge; a full-width grouped sidebar
        // on desktop (off-canvas drawer on mobile via the transform below —
        // index.css forces transform: none >= lg so it stays visible there).
        // Desktop: flush against the top/bottom/left edges — only the right
        // hairline border separates it from the content.
        "fixed top-4 bottom-4 left-4 z-70 lg:top-0 lg:bottom-0 lg:left-0 lg:rounded-none lg:border-y-0 lg:border-l-0",
        railCollapsed ? "w-[250px] lg:w-[68px]" : "w-[250px]"
      )}
      style={{
        transform: drawerOpen ? "translateX(0)" : "translateX(calc(-100% - 24px))",
        transition: "transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)",
      }}
    >
      {/* Brand */}
      <div className={cn("flex items-center gap-2.5 px-3 pb-3 pt-4", railCollapsed && "lg:justify-center lg:px-2")}>
        <a
          href={`https://github.com/${GITHUB_REPO}`}
          target="_blank"
          rel="noreferrer"
          title="Wokroute Router on GitHub"
          className="block shrink-0 transition-transform hover:scale-105 active:scale-95"
        >
          <img
            src={appearanceQuery.data?.settings.runtime.sidebarIconDataUrl || `${import.meta.env.BASE_URL}logo.png`}
            alt="Wokroute"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = `${import.meta.env.BASE_URL}logo.png`;
            }}
            className="size-9 rounded-xl object-cover"
          />
        </a>
        <div className={cn("min-w-0 flex-1", railCollapsed && "lg:hidden")}>
          <a
            href={`https://github.com/${GITHUB_REPO}`}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-[13.5px] font-bold tracking-tight text-[var(--text-1)] transition-colors hover:text-[var(--accent)]"
          >
            Wokroute
          </a>
          <a
            href={releaseQuery.data?.html_url ?? `https://github.com/${GITHUB_REPO}/releases`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] font-semibold text-[var(--text-3)] transition-colors hover:text-[var(--accent)]"
            title={updateAvailable ? `Update available on GitHub: v${latestTag}` : "View releases on GitHub"}
          >
            v{localVersion ?? "\u2026"}
            {updateAvailable && <span className="size-1.5 rounded-full bg-[var(--accent)]" aria-label="Update available" />}
          </a>
        </div>
        {/* Collapse toggle — desktop, expanded state */}
        <button
          type="button"
          onClick={toggleRailCollapsed}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
          className={cn("grid size-7 shrink-0 place-items-center rounded-md text-[var(--text-3)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)] max-lg:hidden", railCollapsed && "lg:hidden")}
        >
          <ChevronsLeft size={14} />
        </button>
      </div>
      {/* Expand toggle — desktop, collapsed state */}
      {railCollapsed && (
        <div className="flex justify-center pb-2 max-lg:hidden">
          <button
            type="button"
            onClick={toggleRailCollapsed}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="grid size-7 place-items-center rounded-md text-[var(--text-3)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      )}

      {/* Nav — grouped horizontal items */}
      <div className="relative min-h-0 flex-1">
        <nav className={cn("scrollbar-fade flex h-full flex-col overflow-y-auto px-3", railCollapsed && "lg:px-2")} aria-label="Primary">
          {NAV_GROUPS.map((group) => (
            <div key={group.label}>
              <div className={cn("px-2.5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]", railCollapsed && "lg:hidden")}>{group.label}</div>
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      title={item.label}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                          isActive
                            ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                            : "text-[var(--text-2)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]",
                          railCollapsed && "lg:justify-center lg:px-0"
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon size={17} strokeWidth={isActive ? 2.1 : 1.8} className="shrink-0" />
                          <span className={cn("min-w-0 flex-1 truncate", railCollapsed && "lg:hidden")}>{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {/* Advanced features — flat inline list */}
          <div>
            <div className={cn("px-2.5 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-3)]", railCollapsed && "lg:hidden")}>Advanced</div>
            <ul className="space-y-0.5">
              {ADVANCED_NAV_GROUPS.flatMap((group) => group.items).map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.to === "/advanced"}
                    title={item.label}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-[13px] font-medium transition-colors duration-150",
                        isActive
                          ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)]"
                          : "text-[var(--text-2)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]",
                        railCollapsed && "lg:justify-center lg:px-0"
                      )
                    }
                  >
                    <item.icon size={17} className="shrink-0" />
                    <span className={cn("min-w-0 flex-1 truncate", railCollapsed && "lg:hidden")}>{item.label}</span>
                    {item.badge && (
                      <span className={cn("rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent)]", railCollapsed && "lg:hidden")}>
                        {item.badge}
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>

        </nav>

        <AnimatePresence>
          {openPanel === "profile" && (
          <m.div
            key="panel-profile"
            role="dialog"
            aria-label="Profile"
            className="absolute bottom-0 left-[calc(100%+12px)] z-50 w-[248px] rounded-2xl border border-[var(--border-subtle)] bg-[var(--popover-bg)] p-3"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: motionProfile === "reduced" ? 0 : 0.16, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex items-center gap-2.5 border-b border-[var(--border-subtle)] px-1 pb-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--text-1)] text-[11px] font-bold text-[var(--page-bg)]">
                {initials}
              </div>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-bold leading-tight">{adminName}</div>
                <div className="text-[10.5px] text-[var(--text-3)]">Wokroute console</div>
              </div>
            </div>
            <div className="pt-2">
              {editingAdminName ? (
                <form
                  className="flex items-center gap-1.5 px-1 pb-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const next = adminNameDraft.trim() || "Admin";
                    setAdminName(next);
                    localStorage.setItem("wokroute.adminName", next);
                    setEditingAdminName(false);
                  }}
                >
                  <Input autoFocus value={adminNameDraft} onChange={(event) => setAdminNameDraft(event.target.value)} aria-label="Admin display name" className="h-8 min-w-0 flex-1 px-2 text-xs" />
                  <button type="submit" aria-label="Save admin name" title="Save" className="grid size-8 shrink-0 place-items-center rounded-[10px] text-[var(--green)] transition-colors hover:bg-[var(--surface-muted)]">
                    <Check size={14} />
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => { setAdminNameDraft(adminName); setEditingAdminName(true); }}
                  className="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-[12.5px] font-medium text-[var(--text-2)] transition-colors hover:bg-[var(--surface-muted)] hover:text-[var(--text-1)]"
                >
                  <Pencil size={14} className="shrink-0" />
                  Edit display name
                </button>
              )}
              <button
                type="button"
                onClick={() => { void apiPost("/logout").finally(() => navigate("/login", { replace: true })); }}
                className="flex w-full items-center gap-2.5 rounded-[12px] px-2.5 py-2 text-[12.5px] font-medium text-[var(--red)] transition-colors hover:bg-[var(--red-soft)]"
              >
                <LogOut size={14} className="shrink-0" />
                Sign out
              </button>
            </div>
          </m.div>
        )}
        </AnimatePresence>
      </div>

      {/* Profile */}
      <div className={cn("border-t border-[var(--border-subtle)] p-2.5", railCollapsed && "lg:p-2")}>
        <button
          type="button"
          onClick={() => setOpenPanel((current) => (current === "profile" ? null : "profile"))}
          aria-haspopup="dialog"
          aria-expanded={openPanel === "profile"}
          title={adminName}
          className={cn(
            "group flex w-full items-center gap-2.5 rounded-[10px] px-1.5 py-1.5 text-left transition-colors hover:bg-[var(--surface-muted)]",
            railCollapsed && "lg:justify-center lg:px-0"
          )}
        >
          <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[var(--text-1)] text-[11px] font-bold text-[var(--page-bg)]">
            {initials}
            <span className="absolute -right-0 -top-0 size-2.5 rounded-full border-2 border-[var(--surface-1)] bg-[var(--status-success)]" aria-hidden="true" />
          </span>
          <span className={cn("min-w-0 flex-1", railCollapsed && "lg:hidden")}>
            <span className="block truncate text-[12.5px] font-bold leading-tight text-[var(--text-1)]">{adminName}</span>
            <span className="block truncate text-[10.5px] text-[var(--text-3)]">Wokroute console</span>
          </span>
        </button>
      </div>
    </aside>

  ), [drawerOpen, openPanel, motionProfile, railCollapsed, appearanceQuery.data?.settings.runtime.sidebarIconDataUrl, localVersion, updateAvailable, releaseQuery.data?.html_url, latestTag, adminName, adminNameDraft, editingAdminName, initials]);

  return (
    <>
      {/* The sidebar is pinned to the viewport's left edge (position: fixed),
          so this wrapper only reserves space for it on desktop via padding. */}
      <div className={cn("relative z-10 min-h-dvh p-4", railCollapsed ? "lg:pl-[84px]" : "lg:pl-[266px]")}>
      <div className="mx-auto w-full max-w-7xl">
      {drawerOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-60 cursor-default bg-[var(--text-primary)]/40 lg:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      {sidebar}

      <div className={cn("flex min-h-0 min-w-0 flex-col gap-4", isFullBleed && "h-dvh overflow-hidden")}>
        <header>
          <div className="flex items-center gap-2.5 py-1 sm:gap-3.5">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open menu"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-2)] shadow-[var(--shadow-soft)] transition-[background-color,color,transform] hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-95 lg:hidden"
            >
              <Menu size={18} />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-[20px] font-bold tracking-tight sm:text-[22px]">Hello, {adminName}!</h1>
              <p className="truncate text-[12px] text-[var(--text-3)]">Explore information and activity about your system</p>
            </div>
            <StatusClock statusData={statusQuery.data} isError={statusQuery.isError} />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden h-10 w-full max-w-[340px] items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] px-4 text-[12.5px] text-[var(--text-3)] shadow-[var(--shadow-soft)] transition-colors hover:border-[var(--border-strong)] md:flex"
            >
              <Search size={14} className="shrink-0" />
              <span className="flex-1 text-left">Search…</span>
              <kbd className="rounded-[6px] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[9.5px] font-semibold text-[var(--text-3)]">⌘K</kbd>
            </button>
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Search"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-2)] shadow-[var(--shadow-soft)] transition-colors hover:text-[var(--text-1)] md:hidden"
            >
              <Search size={16} />
            </button>
            <ThemeToggle />
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => setNotificationsOpen((current) => !current)}
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                aria-haspopup="dialog"
                className="relative grid h-10 w-10 place-items-center rounded-full border border-[var(--border-subtle)] bg-[var(--surface-1)] text-[var(--text-2)] shadow-[var(--shadow-soft)] transition-[background-color,color,transform] duration-150 hover:bg-[var(--surface-2)] hover:text-[var(--text-1)] active:scale-90"
              >
                <Bell size={17} />
                {updateAvailable && <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />}
              </button>
              <NotificationsDialog open={notificationsOpen} onClose={() => setNotificationsOpen(false)} statusData={statusQuery.data} isHealthError={statusQuery.isError} updateAvailable={updateAvailable} latestTag={latestTag} />
            </div>
          </div>
        </header>

        {/* `flex-1 min-h-0` lets a page opt into filling the remaining
            space between the sticky header and footer (e.g. Console Log's
            `h-full` root) instead of the old `max-h-[calc(100vh-Npx)]`
            magic-number hack; pages that don't opt in render at their
            natural content height exactly as before — a column flex
            child's main-axis size stays content-driven unless it sets its
            own `flex-1`/`h-full`. */}
        <main className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <m.div key={location.pathname} {...routeTransition} className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
              <AnimatedOutlet />
          </m.div>
        </main>

      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>
      </div>
    </>
  );
}
