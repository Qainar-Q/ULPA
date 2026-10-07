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
import LoginPage from "./pages/LoginPage.jsx";
import ActivatePage from "./pages/ActivatePage.jsx";
import AdminStudentsPage from "./pages/AdminStudentsPage.jsx";
import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminSchedulePage from "./pages/admin/AdminSchedulePage.jsx";
import AdminOverviewPage from "./pages/admin/AdminOverviewPage.jsx";
import { GpaProvider } from "./features/gpa/GpaContext.jsx";
import { AuthProvider } from "./features/auth/AuthContext.jsx";
import { CatalogProvider } from "./features/catalog/CatalogContext.jsx";
import { TasksProvider } from "./features/tasks/TasksContext.jsx";
import { UnreadProvider } from "./features/unread/UnreadContext.jsx";
import TaskDetailPage from "./pages/TaskDetailPage.jsx";
import AnnouncementsPage from "./pages/AnnouncementsPage.jsx";
import GuestPage from "./pages/GuestPage.jsx";
import MaterialsPage from "./pages/MaterialsPage.jsx";
import PollsPage from "./pages/PollsPage.jsx";
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from "./features/auth/guards.jsx";

export default function App() {
  return (
    <AuthProvider>
      <CatalogProvider>
      <TasksProvider>
      <UnreadProvider>
      <GpaProvider>
        <Routes>
          {/* Public guest overview: counts only, no content */}
          <Route path="guest" element={<GuestPage />} />

          {/* Public: sign-in and activation */}
          <Route element={<RedirectIfSignedIn />}>
            <Route path="login" element={<LoginPage />} />
            <Route path="activate" element={<ActivatePage />} />
          </Route>

          {/* Everything else requires a signed-in student */}
          <Route element={<RequireAuth />}>
            <Route element={<AppShell />}>
              <Route index element={<HomePage />} />
              <Route path="schedule" element={<SchedulePage />} />
              <Route path="photos" element={<PhotosPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="tasks/:id" element={<TaskDetailPage />} />
              <Route path="gpa" element={<GpaPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="materials" element={<MaterialsPage />} />
              <Route path="polls" element={<PollsPage />} />
              <Route path="courses/:slug" element={<CourseDetailPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminStudentsPage />} />
                  <Route path="schedule" element={<AdminSchedulePage />} />
                  <Route path="overview" element={<AdminOverviewPage />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
      </GpaProvider>
      </UnreadProvider>
      </TasksProvider>
      </CatalogProvider>
    </AuthProvider>
  );
}
