import { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Columns3, Package, Users, TrendingUp, Zap, RotateCcw, Settings, LogOut, Plus, MoreHorizontal } from "lucide-react";
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

  const coreNav = [
    { path: "/", label: "Triage", icon: LayoutDashboard },
    { path: "/workshop", label: "Workshop", icon: Columns3 },
  ];

  const moreNav = [
    { path: "/inventory", label: "Inventory", icon: Package },
    { path: "/customers", label: "Customers", icon: Users },
    { path: "/finance", label: "Finance", icon: TrendingUp },
    { path: "/recovery", label: "Recovery", icon: RotateCcw },
    ...(isAdmin ? [
      { path: "/services", label: "Services", icon: Settings },
      { path: "/automations", label: "Automations", icon: Zap },
    ] : []),
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <button onClick={() => navigate("/")} className="text-left">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Restoree <span className="text-primary">360</span>
            </h1>
            <p className="text-xs text-muted-foreground">Shoe & Bag Restoration OS</p>
          </button>
          <div className="flex items-center gap-2">
            <Button
              className="rounded-[28px] gap-2 px-5 shadow-md hover:shadow-lg transition-shadow min-h-[48px]"
              onClick={() => navigate("/?newLead=1")}
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Lead</span>
            </Button>
            <AlertBell />
            <Button variant="ghost" size="icon" onClick={signOut} title="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md">
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
