import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    } else {
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm glass-card-glow">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-display">
            <span className="text-gold-gradient">Restoree</span>{" "}
            <span className="text-primary">360</span>
          </CardTitle>
          <CardDescription className="font-tech">Sign in to your team account</CardDescription>
        </CardHeader>
        <form onSubmit={handleLogin}>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="font-tech text-xs uppercase tracking-widest text-muted-foreground">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="bg-input/50 border-primary/20 focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password" className="font-tech text-xs uppercase tracking-widest text-muted-foreground">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="bg-input/50 border-primary/20 focus:border-primary/50" />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign In
            </Button>
            <p className="text-sm text-muted-foreground font-tech">
              No account?{" "}
              <Link to="/signup" className="font-medium text-primary hover:underline">
                Sign up
              </Link>
            </p>
            <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary font-tech">
              Forgot password?
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default Login;
