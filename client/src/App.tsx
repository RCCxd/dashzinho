import { AppShell } from "@/components/AppShell";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { trpc } from "@/lib/trpc";
import AchievementsPage from "@/pages/AchievementsPage";
import ActivitiesPage from "@/pages/ActivitiesPage";
import DashboardPage from "@/pages/DashboardPage";
import FocusPage from "@/pages/FocusPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "@/pages/NotFound";
import PlannerPage from "@/pages/PlannerPage";
import SettingsPage from "@/pages/SettingsPage";
import SubjectsPage from "@/pages/SubjectsPage";
import { Loader2 } from "lucide-react";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

function AuthenticatedRoutes() {
  return <Switch>
    <Route path="/" component={DashboardPage} />
    <Route path="/activities" component={ActivitiesPage} />
    <Route path="/subjects" component={SubjectsPage} />
    <Route path="/focus" component={FocusPage} />
    <Route path="/achievements" component={AchievementsPage} />
    <Route path="/planner" component={PlannerPage} />
    <Route path="/settings" component={SettingsPage} />
    <Route path="/404" component={NotFound} />
    <Route component={NotFound} />
  </Switch>;
}

function AppContent() {
  const auth = trpc.auth.me.useQuery();
  const [location] = useLocation();
  if (auth.isLoading) return <div className="grid min-h-screen place-items-center bg-[#10111a]"><Loader2 className="size-7 animate-spin text-[#5B6CFF]" /></div>;
  if (!auth.data || location === "/login") return <LoginPage />;
  return <AppShell user={auth.data}><AuthenticatedRoutes /></AppShell>;
}

export default function App() {
  return <ErrorBoundary><ThemeProvider><TooltipProvider><Toaster richColors position="top-right" /><AppContent /></TooltipProvider></ThemeProvider></ErrorBoundary>;
}
