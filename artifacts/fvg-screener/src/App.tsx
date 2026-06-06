import { Router as WouterRouter, Route, Switch } from "wouter";
import Screener from "@/pages/Screener";

function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400">
      <p>Page not found.</p>
    </div>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <Switch>
        <Route path="/" component={Screener} />
        <Route component={NotFound} />
      </Switch>
    </WouterRouter>
  );
}

export default App;
