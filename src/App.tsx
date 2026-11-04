import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import AppShell from "./components/AppShell";
import Builder from "./pages/Builder";
import SignIn from "./pages/SignIn";
import Home from "./pages/Home";
import JourneyPage from "./pages/Journey";
import Coach from "./pages/Coach";
import CoachJourney from "./pages/CoachJourney";
import PointsPage from "./pages/Points";
import Community from "./pages/Community";
import Friends from "./pages/Friends";
import { Privacy, Terms } from "./pages/Legal";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />
      <Route element={<AppShell />}>
        <Route path="/start/:goal" element={<Builder />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/app" element={<Home />} />
        <Route path="/app/j/:id" element={<JourneyPage />} />
        <Route path="/app/points" element={<PointsPage />} />
        <Route path="/app/community" element={<Community />} />
        <Route path="/app/friends" element={<Friends />} />
        <Route path="/coach" element={<Coach />} />
        <Route path="/coach/:id" element={<CoachJourney />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
