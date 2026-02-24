import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, TrendingUp, Zap, RotateCcw, Settings, LogOut, Plus, MoreHorizontal, PanelLeftClose, PanelLeft, Hammer, Cog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import AlertBell from "@/components/AlertBell";

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();
  const [moreOpen, setMoreOpen] = useState(false);
  const [navCollapsed, setNavCollapsed] = useState(false);

  const coreNav = [
    { path: "/", label: "Triage", icon: LayoutDashboard },
    { path: "/workshop", label: "Workshop", icon: Hammer },
    { path: "/customers", label: "Customers", icon: Users },
  ];

  const moreNav = [
    { path: "/finance", label: "Finance", icon: TrendingUp },
    { path: "/recovery", label: "Recovery", icon: RotateCcw },
    ...(isAdmin ? [
      { path: "/services", label: "Services", icon: Settings },
      { path: "/automations", label: "Automations", icon: Zap },
      { path: "/service-master", label: "Service Master", icon: Cog },
    ] : []),
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0 md:flex">
      {/* Desktop sidebar — collapsible */}
      <aside className={cn(
        "hidden md:flex flex-col border-r border-border bg-card transition-all duration-200 shrink-0",
        navCollapsed ? "w-16" : "w-52"
      )}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          {!navCollapsed && (
            <button onClick={() => navigate("/")} className="text-left">
              <h1 className="text-base font-extrabold tracking-tight text-foreground">
                Restoree <span className="text-primary">360</span>
              </h1>
            </button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setNavCollapsed(!navCollapsed)}
            className="h-8 w-8 shrink-0"
          >
            {navCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>

        <nav className="flex-1 p-2 space-y-1">
          {coreNav.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive(path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                navCollapsed && "justify-center px-0"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!navCollapsed && label}
            </button>
          ))}

          <div className="border-t border-border my-2" />

          {moreNav.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-xs font-medium transition-colors",
                isActive(path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                navCollapsed && "justify-center px-0"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!navCollapsed && label}
            </button>
          ))}
        </nav>

        <div className="p-2 border-t border-border">
          <button
            onClick={signOut}
            className={cn(
              "flex items-center gap-3 w-full rounded-lg px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors",
              navCollapsed && "justify-center px-0"
            )}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!navCollapsed && "Sign out"}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
          <div className="flex items-center justify-between px-4 py-3 sm:px-6">
            <button onClick={() => navigate("/")} className="text-left md:hidden">
              <h1 className="text-xl font-extrabold tracking-tight text-foreground">
                Restoree <span className="text-primary">360</span>
              </h1>
            </button>
            <div className="hidden md:block" />
            <div className="flex items-center gap-2">
              <Button
                className="rounded-[28px] gap-2 px-5 shadow-md hover:shadow-lg transition-shadow min-h-[48px]"
                onClick={() => navigate("/?newLead=1")}
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">New Lead</span>
              </Button>
              <AlertBell />
              <Button variant="ghost" size="icon" onClick={signOut} title="Sign out" className="md:hidden">
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md md:hidden">
        <div className="mx-auto flex max-w-md items-center justify-around py-2">
          {coreNav.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-6 py-1.5 text-[11px] font-medium transition-colors min-h-[48px] justify-center",
                isActive(path) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}

          <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
            <SheetTrigger asChild>
              <button className="flex flex-col items-center gap-0.5 px-6 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground min-h-[48px] justify-center">
                <MoreHorizontal className="h-5 w-5" />
                More
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl">
              <SheetHeader>
                <SheetTitle>More</SheetTitle>
              </SheetHeader>
              <div className="grid grid-cols-3 gap-3 py-4">
                {moreNav.map(({ path, label, icon: Icon }) => (
                  <button
                    key={path}
                    onClick={() => { navigate(path); setMoreOpen(false); }}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl p-4 min-h-[64px] transition-colors",
                      isActive(path) ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
