import { Navigate, Route, Routes } from "react-router-dom";
import Landing from "./pages/Landing";
import AppShell from "./components/AppShell";
import ClientHome from "./pages/ClientHome";
import Intake from "./pages/Intake";
import ClientCase from "./pages/ClientCase";
import Flagged from "./pages/Flagged";
import ClinicianGate from "./pages/ClinicianGate";
import Queue from "./pages/Queue";
import ClinicianCase from "./pages/ClinicianCase";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route element={<AppShell />}>
        <Route path="/app" element={<ClientHome />} />
        <Route path="/app/intake" element={<Intake />} />
        <Route path="/app/flagged" element={<Flagged />} />
        <Route path="/app/case/:id" element={<ClientCase />} />
        <Route path="/clinician" element={<ClinicianGate />}>
          <Route index element={<Queue />} />
          <Route path="case/:id" element={<ClinicianCase />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
