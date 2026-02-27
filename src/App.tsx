import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminRoute from "@/components/AdminRoute";
import AppLayout from "@/components/AppLayout";
import Index from "./pages/Index";
import LeadDetail from "./pages/LeadDetail";
import Services from "./pages/Services";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Finance from "./pages/Finance";
import Automations from "./pages/Automations";
import Recovery from "./pages/Recovery";
import Workshop from "./pages/Workshop";
import Inventory from "./pages/Inventory";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
import Quote from "./pages/Quote";
import AdminHub from "./pages/AdminHub";
import Orders from "./pages/Orders";
import OrderDetail from "./pages/OrderDetail";
import Portal from "./pages/Portal";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/quote/:token" element={<Quote />} />
            <Route path="/portal/:customerId" element={<Portal />} />
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/" element={<Index />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/services" element={<Services />} />
              <Route path="/finance" element={<AdminRoute requiredRole="super_admin"><Finance /></AdminRoute>} />
              <Route path="/automations" element={<AdminRoute><Automations /></AdminRoute>} />
              <Route path="/recovery" element={<Recovery />} />
              <Route path="/workshop" element={<Workshop />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/admin-hub" element={<AdminRoute><AdminHub /></AdminRoute>} />
            </Route>
            <Route path="/leads/:id" element={<ProtectedRoute><LeadDetail /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute><OrderDetail /></ProtectedRoute>} />
            <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
