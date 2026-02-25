import { Navigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  requiredRole?: "admin" | "super_admin";
};

const AdminRoute = ({ children, requiredRole = "admin" }: Props) => {
  const { isAdmin, isSuperAdmin, isLoading } = useUserRole();
  const { toast } = useToast();
  const toasted = useRef(false);

  const hasAccess =
    requiredRole === "super_admin" ? isSuperAdmin : isAdmin;

  useEffect(() => {
    if (!isLoading && !hasAccess && !toasted.current) {
      toasted.current = true;
      toast({ title: "Access Denied", description: "You don't have permission to view this page.", variant: "destructive" });
    }
  }, [isLoading, hasAccess]);

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasAccess) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
