import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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

export function isResearcherSignedIn() {
  return sessionStorage.getItem("trewel-researcher") === "1";
}

function RequireResearcher({ children }) {
  const location = useLocation();
  if (!isResearcherSignedIn()) {
    return <Navigate to="/researcher" replace state={{ from: location.pathname }} />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/researcher" element={<ResearcherLogin />} />
      <Route path="/researcher/dashboard" element={<RequireResearcher><ResearcherDashboard /></RequireResearcher>} />
      <Route path="/researcher/review" element={<RequireResearcher><ReviewQueue /></RequireResearcher>} />
      <Route path="/researcher/data-handling" element={<RequireResearcher><DataHandling /></RequireResearcher>} />
      <Route path="/researcher/studies/new" element={<RequireResearcher><StudyNew /></RequireResearcher>} />
      <Route path="/researcher/studies/:id" element={<RequireResearcher><StudyDetail /></RequireResearcher>} />
      <Route path="/researcher/studies/:id/participants/:code" element={<RequireResearcher><ParticipantDetail /></RequireResearcher>} />
      <Route path="/participant" element={<ParticipantJoin />} />
      <Route path="/participant/:code" element={<ParticipantHome />} />
      <Route path="/participant/:code/log" element={<LogMeal />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
