import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { billingMessage, billingState } from "@/lib/billing";
import { paymentAccounts } from "@/lib/company";
import { buildNotifications, filterNotifications } from "@/lib/notifications";
import {
  READ_EVENT,
  badgeCount,
  bellLabel,
  isRead,
  markAllRead,
  markRead,
  readSignatures,
} from "@/lib/notificationsRead";
import { analysisInputFromCase } from "@/lib/caseAnalysis";
import { analyseCrisis } from "@/lib/crisisAnalysis";
import type { UserRole } from "@/data/types";
import {
  BarChart3,
  Bell,
  Briefcase,
  Building2,
  FileText,
  Gauge,
  History,
  Inbox,
  LayoutDashboard,
  Lock,
  LogOut,
  type LucideIcon,
  Menu,
  MessageSquare,
  Scale,
  Settings,
  TrendingDown,
  UserPlus,
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
  { icon: UserPlus, label: "Deltagare", href: "/dashboard/deltagare" },
  /* Max 7 menyval (Excellence rond 2). Kreditunderlag nås från Dokument,
     rådgivarkatalogen från Deltagare - handlingar och bemanning är delar av
     ärendet, inte egna arbetsytor. Lägg inte tillbaka dem här. */
  { icon: History, label: "Händelselogg", href: "/dashboard/handelser" },
  { icon: Settings, label: "Inställningar", href: "/dashboard/installningar" },
];

const ADVISOR_NAV: NavItem[] = [
  { icon: Briefcase, label: "Klienter", href: "/arenden" },
  { icon: LayoutDashboard, label: "Aktivt ärende", href: "/dashboard" },
  { icon: MessageSquare, label: "Meddelanden", href: "/dashboard/meddelanden" },
  { icon: Briefcase, label: "Mina förfrågningar", href: "/mina-forfragningar" },
  { icon: FileText, label: "Byråprofil och team", href: "/byraprofil" },
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
  if (!message || state.isLocked) return null;

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

/**
 * Stängningsvyn. Ersätter sidans innehåll när kontot är stängt.
 *
 * Det här är själva mekanismen bakom den beslutade modellen - fram tills den
 * fanns var frysningen en text, inte en spärr. Tre saker vyn måste göra:
 *
 *  1. Säga exakt vad, vart och med vilken referens man betalar. Den som
 *     vill låsa upp ska inte behöva leta.
 *  2. Lova att ingenting är raderat, med samma ord som mejlet och
 *     inställningssidan. Olika formuleringar om samma sak läses som
 *     motstridiga besked.
 *  3. Lämna fakturorna åtkomliga. Att låsa inne själva fakturan man ska
 *     betala vore ett moment 22 - därför släpps inställningssidan igenom.
 *
 * Spärren är ett gränssnittsbeslut, inte en säkerhetsgräns: datan skyddas av
 * radskyddet i databasen oavsett. Men betalmodellen upprätthålls här.
 */
const LockedAccountView = ({ signOut }: { signOut: () => void }) => {
  const accounts = paymentAccounts();

  return (
    <main className="mx-auto max-w-xl p-4 py-16 lg:p-8">
      <div className="rounded-md border border-destructive/40 bg-card p-8">
        <Lock className="h-8 w-8 text-destructive" aria-hidden="true" />
        <h1 className="mt-4 font-display text-2xl text-foreground">Kontot är stängt</h1>
        <p className="mt-3 leading-relaxed text-muted-foreground">
          Vi har inte fått in betalningen. Ditt material finns kvar och blir
          tillgängligt igen så snart betalningen registreras – vi raderar
          ingenting.
        </p>

        {accounts.length > 0 && (
          <div className="mt-6 rounded-md bg-secondary/50 p-4">
            <p className="text-sm font-semibold text-foreground">Så öppnar du kontot igen</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              {accounts.map((a) => (
                <li key={a.label}>
                  {a.label}:{" "}
                  <span className="font-medium tabular-nums text-foreground">{a.number}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-muted-foreground">
              Ange fakturanumret som referens. Fakturan hittar du nedan.
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button variant="accent" asChild>
            <Link to="/dashboard/installningar">Se din faktura</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/kontakt">Stämmer inte det här?</Link>
          </Button>
          <Button variant="ghost" onClick={signOut}>
            Logga ut
          </Button>
        </div>
      </div>
    </main>
  );
};

/**
 * Notiscentret: allt som väntar på användaren, från alla källor.
 *
 * Frister, kontrollbalansläget, taggade meddelanden, deltagarsvar och - för
 * driften - larm om utskick, inkorg, ansökningar och profilanspråk, byggda
 * av samma deterministiska aggregator som testerna kör. En notis släcks av
 * att saken hanteras där den hör hemma (kvittensen i tråden, beslutet i
 * driftvyn), inte av att panelen öppnats: att ha sett klockan är inte att
 * ha svarat rekonstruktören.
 */
const NotificationBell = () => {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: mentions } = useQuery({
    queryKey: ["open-mentions"],
    queryFn: () => data.messages.myOpenMentions(),
    retry: false,
    refetchInterval: 60_000,
  });
  const { data: latestCase } = useQuery({
    queryKey: ["latest-case-bell"],
    queryFn: () => data.cases.getLatest(),
    retry: false,
  });
  const caseId = latestCase?.id ?? null;
  const { data: kbr } = useQuery({
    queryKey: ["kbr-latest", caseId],
    queryFn: () => data.kbr.getLatestByCase(caseId as string),
    enabled: caseId !== null,
    retry: false,
  });
  const { data: invitations } = useQuery({
    queryKey: ["case-invitations", caseId],
    queryFn: () => data.members.listInvitations(caseId as string),
    enabled: caseId !== null,
    retry: false,
  });
  const { data: caseTasks } = useQuery({
    queryKey: ["case-tasks", caseId],
    queryFn: () => data.tasks.listByCase(caseId as string),
    enabled: caseId !== null,
    retry: false,
  });
  const { data: isAdmin } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => data.contact.amIAdmin(),
    retry: false,
  });
  const { data: outbox } = useQuery({
    queryKey: ["outbox"],
    queryFn: () => data.billing.listOutbox(),
    enabled: isAdmin === true,
    retry: false,
  });
  const { data: contactMessages } = useQuery({
    queryKey: ["admin-contact"],
    queryFn: () => data.contact.listAll(),
    enabled: isAdmin === true,
    retry: false,
  });
  const { data: applications } = useQuery({
    queryKey: ["admin-applications"],
    queryFn: () => data.applications.listAll(),
    enabled: isAdmin === true,
    retry: false,
  });
  const { data: profileClaims } = useQuery({
    queryKey: ["profile-claims"],
    queryFn: () => data.professionals.listClaims(),
    enabled: isAdmin === true,
    retry: false,
  });

  const analysis = latestCase ? analyseCrisis(analysisInputFromCase(latestCase)) : null;
  // Enhetens notisval (inställningarna) filtrerar det sociala och driften.
  // Frister och läget går aldrig att stänga av - det är klockans löfte.
  const notifications = filterNotifications(buildNotifications({
    caseRecord: latestCase ?? null,
    crisis: analysis ? { urgency: analysis.urgency, title: analysis.title } : null,
    timeline: analysis?.timeline ?? [],
    mentions: mentions ?? [],
    invitations: invitations ?? [],
    assignedOpenTasks: (caseTasks ?? []).filter(
      (t) => !t.doneAt && t.assignedTo !== null && t.assignedTo === user?.id,
    ).length,
    kbr: kbr ?? null,
    failedEmails: (outbox ?? []).filter((m) => m.status === "failed"),
    pendingApplications: (applications ?? []).filter((a) => a.status === "pending").length,
    newContactMessages: (contactMessages ?? []).filter((m) => m.status === "new").length,
    pendingProfileClaims: (profileClaims ?? []).filter((c) => c.status === "pending").length,
    now: new Date(),
  }));
  // Siffran är OLÄST och KRÄVER något - se src/lib/notificationsRead.ts.
  // Läsmängden ligger i tillstånd så att en kvittering syns direkt;
  // händelsen fångar kvitteringar gjorda i en annan flik.
  const [read, setRead] = useState(readSignatures);
  useEffect(() => {
    const refresh = () => setRead(readSignatures());
    window.addEventListener(READ_EVENT, refresh);
    return () => window.removeEventListener(READ_EVENT, refresh);
  }, []);

  const count = badgeCount(notifications, read);
  const unreadItems = notifications.filter((n) => !isRead(n, read));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={bellLabel(count)}
        aria-expanded={open}
        className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-frist px-1 text-[10px] font-semibold text-white">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div className="panel-reveal absolute right-0 top-full z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-md border border-border bg-card p-2 shadow-medium">
          <div className="flex items-baseline justify-between gap-2 px-2 py-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Notiser
            </p>
            {unreadItems.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  // Kvitterar ALLT som visas, inte bara det som räknas:
                  // annars ligger de olästa informationsraderna kvar och
                  // ser oavklarade ut fast siffran är noll.
                  markAllRead(notifications);
                  setRead(readSignatures());
                }}
                className="text-xs font-medium text-accent underline-offset-4 hover:underline"
              >
                Markera alla som lästa
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted-foreground">
              Inget kräver dig just nu. Frister, taggade meddelanden,
              deltagarsvar och driftlarm dyker upp här.
            </p>
          ) : (
            /* Ingen avhuggning. Listan visade tidigare åtta rader medan
               siffran räknade alla - och den som hade tolv fick aldrig
               veta att fyra fanns. En lista som rullar är ärligare än en
               som tystnar. */
            <ul className="max-h-96 overflow-y-auto">
              {notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      // Klicket ÄR kvitteringen: den som gått dit har
                      // sett saken. Trappas läget upp senare får raden
                      // ett nytt fingeravtryck och blir oläst igen.
                      markRead(n);
                      setRead(readSignatures());
                      setOpen(false);
                      // En notis vars mål är sidan man redan står på måste
                      // ändå göra något synligt: ankaret rullar till rätt
                      // sektion, efter navigering om en sådan behövs.
                      // Sidjämförelsen måste vara EXAKT: en prefixmatchning
                      // gjorde att "/dashboard/handelser" räknades som
                      // "/dashboard" i hash-läget, navigeringen hoppades
                      // över och klicket blev osynligt.
                      const [path, anchor] = n.href.split("#");
                      const currentPath = window.location.hash.startsWith("#/")
                        ? window.location.hash.slice(1)
                        : window.location.pathname;
                      const samePage = currentPath === path;
                      if (!samePage) navigate(path);
                      if (anchor) {
                        window.setTimeout(
                          () => document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" }),
                          samePage ? 0 : 350,
                        );
                      }
                    }}
                    className={`w-full rounded-md px-2 py-2 text-left transition-colors hover:bg-secondary ${
                      isRead(n, read) ? "opacity-55" : ""
                    }`}
                  >
                    <span
                      className={`block text-sm font-medium ${
                        n.tone === "critical" ? "text-frist" : "text-foreground"
                      }`}
                    >
                      {n.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {n.body}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
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

  const { data: billing } = useQuery({
    queryKey: ["my-billing"],
    queryFn: () => data.billing.getMine(),
    retry: false,
  });

  // Låst konto: innehållet byts mot stängningsvyn. Två undantag:
  //  - Inställningar, där fakturan man ska betala ligger. Att låsa inne den
  //    vore ett moment 22.
  //  - Driftvyerna (/admin/*): det är där betalningen som låser upp
  //    registreras, så de får aldrig ligga bakom låset.
  const locked =
    billing !== undefined &&
    billingState(billing, new Date()).isLocked &&
    pathname !== "/dashboard/installningar" &&
    !pathname.startsWith("/admin");

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
                  to="/admin"
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathname === "/admin" ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium transition-colors ${
                    pathname === "/admin"
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                  }`}
                >
                  <Gauge className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Driftpanel</span>
                </Link>
                <Link
                  to="/admin/inkorg"
                  onClick={() => setSidebarOpen(false)}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Inbox className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Inkorg</span>
                </Link>
                <Link
                  to="/admin/ansokningar"
                  onClick={() => setSidebarOpen(false)}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Briefcase className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Ansökningar</span>
                </Link>
                <Link
                  to="/admin/kunder"
                  onClick={() => setSidebarOpen(false)}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Users className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Kunder</span>
                </Link>
                <Link
                  to="/admin/foretag"
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathname === "/admin/foretag" ? "page" : undefined}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Building2 className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Företag</span>
                </Link>
                <Link
                  to="/admin/radgivare"
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathname === "/admin/radgivare" ? "page" : undefined}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Scale className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Rådgivare</span>
                </Link>
                <Link
                  to="/admin/statistik"
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathname === "/admin/statistik" ? "page" : undefined}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <BarChart3 className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Statistik</span>
                </Link>
                <Link
                  to="/admin/analys"
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathname === "/admin/analys" ? "page" : undefined}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <Gauge className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Analysövervakning</span>
                </Link>
                <Link
                  to="/admin/loggar"
                  onClick={() => setSidebarOpen(false)}
                  aria-current={pathname === "/admin/loggar" ? "page" : undefined}
                  className="flex w-full items-center gap-3 rounded-md px-4 py-3 text-sm font-medium text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                >
                  <History className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 text-left">Loggar</span>
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
          <NotificationBell />
          {actions}
        </header>

        {locked ? (
          <LockedAccountView signOut={() => void handleSignOut()} />
        ) : (
          <main className="p-4 lg:p-8">{children}</main>
        )}
      </div>
    </div>
  );
};
