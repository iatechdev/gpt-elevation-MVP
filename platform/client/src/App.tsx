import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Onboarding from "./pages/Onboarding";
import Chat from "./pages/Chat";
import Reflections from "./pages/Reflections";
import Insights from "./pages/Insights";
import Profile from "./pages/Profile";
import Reminders from "./pages/Reminders";
import CompanionConfig from "./pages/CompanionConfig";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/chat" component={Chat} />
      <Route path="/reflections" component={Reflections} />
      <Route path="/insights" component={Insights} />
      <Route path="/profile" component={Profile} />
      <Route path="/reminders" component={Reminders} />
      <Route path="/companion-config" component={CompanionConfig} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster
            toastOptions={{
              style: {
                background: "oklch(0.15 0.025 265)",
                border: "1px solid oklch(0.22 0.03 265)",
                color: "oklch(0.93 0.01 265)",
              },
            }}
          />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
