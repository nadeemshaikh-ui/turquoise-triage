import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export const useUserRole = () => {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      if (error) throw error;
      return (data || []).map((r) => r.role);
    },
    enabled: !!user?.id,
  });

  const roles = query.data ?? [];

  return {
    roles,
    isSuperAdmin: roles.includes("super_admin" as any),
    isAdmin: roles.includes("admin") || roles.includes("super_admin" as any),
    isStaff: roles.length > 0 && !roles.includes("admin") && !roles.includes("super_admin" as any),
    isLoading: query.isLoading,
  };
};
