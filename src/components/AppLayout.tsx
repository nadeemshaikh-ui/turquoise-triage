import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Columns3, Package, Settings, LogOut, Plus, Users, TrendingUp, Zap, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { cn } from "@/lib/utils";
import AlertBell from "@/components/AlertBell";

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { isAdmin } = useUserRole();

  const navItems = [
    { path: "/", label: "Dashboard", icon: LayoutDashboard },
    { path: "/workshop", label: "Workshop", icon: Columns3 },
    { path: "/inventory", label: "Inventory", icon: Package },
    { path: "/customers", label: "Customers", icon: Users },
    { path: "/finance", label: "Finance", icon: TrendingUp },
    { path: "/recovery", label: "Recovery", icon: RotateCcw },
    ...(isAdmin ? [
      { path: "/services", label: "Services", icon: Settings },
      { path: "/automations", label: "Auto", icon: Zap },
    ] : []),
  ];

  const isActive = (path: string) => {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
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
              className="rounded-[28px] gap-2 px-5 shadow-md hover:shadow-lg transition-shadow"
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

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Outlet />
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-md items-center justify-around py-2">
          {navItems.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 text-[10px] font-medium transition-colors",
                isActive(path) ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default AppLayout;
