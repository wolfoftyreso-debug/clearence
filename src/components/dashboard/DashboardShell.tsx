import { useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { billingMessage, billingState } from "@/lib/billing";
import type { UserRole } from "@/data/types";
import {
  Briefcase,
  FileText,
  Inbox,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  MessageSquare,
  Settings,
  TrendingDown,
  Users,
  X,
} from "lucide-react";

/**
 * Ramen runt allt i inloggat läge.
 *
 * Fanns tidigare i två kopior, en i Dashboard och en i LiquidityTimeline. Det
 * var därför tre menyval satt märkta "Snart" på båda ställena: sidorna fanns
 * inte, och ingen av kopiorna visste om den andra. En meny som ljuger om vad
 * produkten kan är värre än en kortare meny.
 *
 * Menyn är rollmedveten. En rådgivare har inget att göra i en
 * likviditetsplan för ett bolag hen inte äger, och en företagare har ingen
 * uppdragslista. Rollen kommer från databasen, inte från en gissning på
 * klienten.
 */

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const COMPANY_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Översikt", href: "/dashboard" },
  { icon: TrendingDown, label: "Likviditet", href: "/dashboard/liquidity" },
  { icon: FileText, label: "Dokument", href: "/dashboard/dokument" },
  { icon: MessageSquare, label: "Meddelanden", href: "/dashboard/meddelanden" },
  { icon: Users, label: "Rådgivare", href: "/marketplace" },
  { icon: Settings, label: "Inställningar", href: "/dashboard/installningar" },
];

const ADVISOR_NAV: NavItem[] = [
  { icon: LayoutDashboard, label: "Översikt", href: "/dashboard" },
  { icon: Briefcase, label: "Mina förfrågningar", href: "/mina-forfragningar" },
  { icon: FileText, label: "Min profil", href: "/for-radgivare" },
  { icon: MessageSquare, label: "Meddelanden", href: "/dashboard/meddelanden" },
  { icon: Settings, label: "Inställningar", href: "/dashboard/installningar" },
];

export const navForRole = (role: UserRole): NavItem[] =>
  role === "advisor" ? ADVISOR_NAV : COMPANY_NAV;

/**
 * Kontovarningen.
 *
 * Sitter i skalet och inte på en enskild sida, så att den syns var användaren
 * än befinner sig. En avstängning som kommer utan förvarning läses som ett
 * fel i tjänsten, inte som en obetald faktura.
 */
const BillingNotice = () => {
  const { data: billing } = useQuery({
    queryKey: ["my-billing"],
    queryFn: () => data.billing.getMine(),
    retry: false,
  });

  if (!billing) return null;
  const state = billingState(billing, new Date());
  const message = billingMessage(state);
  if (!message) return null;

  const tone =
    message.tone === "critical"
      ? "border-destructive/40 bg-destructive/10"
      : "border-warning/40 bg-warning/10";

  return (
    <div className={`border-b px-4 py-3 ${tone}`} role="status">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{message.title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{message.body}</p>
        </div>
        <Button variant="outline" size="sm" className="flex-shrink-0" asChild>
          <Link to="/dashboard/installningar">Se fakturor</Link>
        </Button>
      </div>
    </div>
  );
};

interface DashboardShellProps {
  children: ReactNode;
  /** Visas i sidhuvudet på mobil. */
  title: string;
  /** Knappar till höger i sidhuvudet. */
  actions?: ReactNode;
}

export const DashboardShell = ({ children, title, actions }: DashboardShellProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const { data: profile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => data.profile.getMine(),
    retry: false,
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => data.contact.amIAdmin(),
    retry: false,
  });

  const role: UserRole = profile?.role ?? "company";
  const items = navForRole(role);
  const initials = (profile?.displayName || user?.email || "??").slice(0, 2).toUpperCase();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 h-full w-64 transform bg-sidebar transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-sidebar-border p-4">
            <Link to="/" className="flex min-w-0 items-center gap-2">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-sm bg-sidebar-primary">
                <span className="text-sm font-bold text-sidebar-primary-foreground">C</span>
              </div>
              <span className="truncate font-display text-xl text-sidebar-foreground">
                CLEARANCE
              </span>
            </Link>
            <button
              className="text-sidebar-foreground/70 lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Stäng menyn"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">{item.label}</span>
                </Link>
              );
            })}

            {isAdmin && (
              <>
                <p className="px-4 pb-1 pt-6 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/40">
                  Drift
                </p>
                <Link
                  to="/admin/inkorg"
                  onClick={() => setSidebarOpen(false)}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Inbox className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Inkorg</span>
                </Link>
                <Link
                  to="/admin/kunder"
                  onClick={() => setSidebarOpen(false)}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Users className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Kunder</span>
                </Link>
              </>
            )}
          </nav>

          <div className="border-t border-sidebar-border p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-sidebar-accent">
                <span className="text-sm font-medium text-sidebar-foreground">{initials}</span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {profile?.displayName || user?.email || "Ditt konto"}
                </p>
                <p className="truncate text-xs text-sidebar-foreground/60">
                  {role === "advisor" ? "Rådgivare" : "Företagare"}
                </p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex-shrink-0 rounded-md p-2 text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                aria-label="Logga ut"
                title="Logga ut"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <div className="lg:pl-64">
        <BillingNotice />

        <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3 lg:px-8">
          <button
            className="text-muted-foreground lg:hidden"
            onClick={() => setSidebarOpen(true)}
            aria-label="Öppna menyn"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg text-foreground">{title}</h1>
          {actions}
        </header>

        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
