import { Route, Routes } from "react-router-dom";
import AppShell from "./components/layout/AppShell.jsx";
import HomePage from "./pages/HomePage.jsx";
import SchedulePage from "./pages/SchedulePage.jsx";
import PhotosPage from "./pages/PhotosPage.jsx";
import TasksPage from "./pages/TasksPage.jsx";
import GpaPage from "./pages/GpaPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import CourseDetailPage from "./pages/CourseDetailPage.jsx";
import NotFoundPage from "./pages/NotFoundPage.jsx";
import { GpaProvider } from "./features/gpa/GpaContext.jsx";

export default function App() {
  return (
    <GpaProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="photos" element={<PhotosPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="gpa" element={<GpaPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="courses/:slug" element={<CourseDetailPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </GpaProvider>
  );
}
