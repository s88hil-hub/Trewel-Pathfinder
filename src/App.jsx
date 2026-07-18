import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./lib/auth.jsx";
import Landing from "./pages/Landing.jsx";
import ResearcherLogin from "./pages/ResearcherLogin.jsx";
import ResearcherDashboard from "./pages/ResearcherDashboard.jsx";
import StudyNew from "./pages/StudyNew.jsx";
import StudyDetail from "./pages/StudyDetail.jsx";
import ParticipantDetail from "./pages/ParticipantDetail.jsx";
import ParticipantJoin from "./pages/ParticipantJoin.jsx";
import ParticipantHome from "./pages/ParticipantHome.jsx";
import LogMeal from "./pages/LogMeal.jsx";
import ReviewQueue from "./pages/ReviewQueue.jsx";
import DataHandling from "./pages/DataHandling.jsx";
import Settings from "./pages/Settings.jsx";

function RequirePractitioner({ children }) {
  const { ready, user } = useAuth();
  const location = useLocation();
  if (!ready) return null; // session restore in flight
  if (!user) {
    return <Navigate to="/researcher" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/researcher" element={<ResearcherLogin />} />
      <Route path="/researcher/dashboard" element={<RequirePractitioner><ResearcherDashboard /></RequirePractitioner>} />
      <Route path="/researcher/review" element={<RequirePractitioner><ReviewQueue /></RequirePractitioner>} />
      <Route path="/researcher/data-handling" element={<RequirePractitioner><DataHandling /></RequirePractitioner>} />
      <Route path="/researcher/settings" element={<RequirePractitioner><Settings /></RequirePractitioner>} />
      <Route path="/researcher/studies/new" element={<RequirePractitioner><StudyNew /></RequirePractitioner>} />
      <Route path="/researcher/studies/:id" element={<RequirePractitioner><StudyDetail /></RequirePractitioner>} />
      <Route path="/researcher/studies/:id/participants/:code" element={<RequirePractitioner><ParticipantDetail /></RequirePractitioner>} />
      <Route path="/participant" element={<ParticipantJoin />} />
      <Route path="/participant/:code" element={<ParticipantHome />} />
      <Route path="/participant/:code/log" element={<LogMeal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
