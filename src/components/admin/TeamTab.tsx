import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ShieldCheck, Shield, User } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type TeamMember = {
  user_id: string;
  display_name: string;
  role: string;
};

const ROLE_ICON: Record<string, typeof Shield> = {
  super_admin: ShieldCheck,
  admin: Shield,
  staff: User,
};

const TeamTab = () => {
  const { user } = useAuth();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchMembers = async () => {
    setLoading(true);
    // Get profiles and roles separately, then merge
    const [profilesRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("user_id, display_name"),
      supabase.from("user_roles").select("user_id, role"),
    ]);

    const profiles = profilesRes.data || [];
    const roles = rolesRes.data || [];

    const merged: TeamMember[] = profiles.map((p) => {
      const userRole = roles.find((r) => r.user_id === p.user_id);
      return {
        user_id: p.user_id,
        display_name: p.display_name,
        role: userRole?.role || "staff",
      };
    });

    // Sort: super_admin first, then admin, then staff
    const order = { super_admin: 0, admin: 1, staff: 2 };
    merged.sort((a, b) => (order[a.role as keyof typeof order] ?? 2) - (order[b.role as keyof typeof order] ?? 2));

    setMembers(merged);
    setLoading(false);
  };

  useEffect(() => { fetchMembers(); }, []);

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    setUpdating(targetUserId);
    // Delete existing role, then insert new one
    await supabase.from("user_roles").delete().eq("user_id", targetUserId);
    const { error } = await supabase.from("user_roles").insert({ user_id: targetUserId, role: newRole as any });

    if (error) {
      toast({ title: "Failed to update role", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Role updated", description: `User role changed to ${newRole}` });
      fetchMembers();
    }
    setUpdating(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Current Role</TableHead>
              <TableHead className="text-right">Change Role</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const Icon = ROLE_ICON[m.role] || User;
              const isSelf = m.user_id === user?.id;
              const isSuperAdmin = m.role === "super_admin";

              return (
                <TableRow key={m.user_id}>
                  <TableCell className="font-medium text-foreground">
                    {m.display_name}
                    {isSelf && <Badge variant="outline" className="ml-2 text-[10px]">You</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm capitalize">{m.role.replace("_", " ")}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {isSelf || isSuperAdmin ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {isSelf ? "Locked" : "Protected"}
                      </Badge>
                    ) : (
                      <Select
                        value={m.role}
                        onValueChange={(val) => handleRoleChange(m.user_id, val)}
                        disabled={updating === m.user_id}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="staff">Staff</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
};

export default TeamTab;
