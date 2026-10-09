import { Suspense } from "react";
import { lazyPage } from "./lib/lazyPage.js";
import { Route, Routes } from "react-router-dom";
import PageLoading from "./components/ui/PageLoading.jsx";
import AppShell from "./components/layout/AppShell.jsx";
import HomePage from "./pages/HomePage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import { GpaProvider } from "./features/gpa/GpaContext.jsx";
import { AuthProvider, useAuth } from "./features/auth/AuthContext.jsx";
import { CatalogProvider } from "./features/catalog/CatalogContext.jsx";
import { TasksProvider } from "./features/tasks/TasksContext.jsx";
import { UnreadProvider } from "./features/unread/UnreadContext.jsx";
import { RedirectIfSignedIn, RequireAdmin, RequireAuth } from "./features/auth/guards.jsx";

// Home and login load with the app; every other page is fetched when first opened.
const SchedulePage = lazyPage(() => import("./pages/SchedulePage.jsx"));
const PhotosPage = lazyPage(() => import("./pages/PhotosPage.jsx"));
const TasksPage = lazyPage(() => import("./pages/TasksPage.jsx"));
const GpaPage = lazyPage(() => import("./pages/GpaPage.jsx"));
const ProfilePage = lazyPage(() => import("./pages/ProfilePage.jsx"));
const CourseDetailPage = lazyPage(() => import("./pages/CourseDetailPage.jsx"));
const NotFoundPage = lazyPage(() => import("./pages/NotFoundPage.jsx"));
const ActivatePage = lazyPage(() => import("./pages/ActivatePage.jsx"));
const AdminStudentsPage = lazyPage(() => import("./pages/AdminStudentsPage.jsx"));
const AdminLayout = lazyPage(() => import("./pages/admin/AdminLayout.jsx"));
const AdminSchedulePage = lazyPage(() => import("./pages/admin/AdminSchedulePage.jsx"));
const AdminOverviewPage = lazyPage(() => import("./pages/admin/AdminOverviewPage.jsx"));
const TaskDetailPage = lazyPage(() => import("./pages/TaskDetailPage.jsx"));
const AnnouncementsPage = lazyPage(() => import("./pages/AnnouncementsPage.jsx"));
const GuestPage = lazyPage(() => import("./pages/GuestPage.jsx"));
const MaterialsPage = lazyPage(() => import("./pages/MaterialsPage.jsx"));
const PollsPage = lazyPage(() => import("./pages/PollsPage.jsx"));
const TeachersPage = lazyPage(() => import("./pages/TeachersPage.jsx"));
const SearchPage = lazyPage(() => import("./pages/SearchPage.jsx"));
const AttendancePage = lazyPage(() => import("./pages/AttendancePage.jsx"));
const CampusPage = lazyPage(() => import("./pages/CampusPage.jsx"));
const NotesPage = lazyPage(() => import("./pages/NotesPage.jsx"));
const QuizPage = lazyPage(() => import("./pages/QuizPage.jsx"));
const NotePage = lazyPage(() => import("./pages/NotePage.jsx"));
const DrawPage = lazyPage(() => import("./pages/DrawPage.jsx"));
const SuggestionsPage = lazyPage(() => import("./pages/SuggestionsPage.jsx"));
const TranslatePage = lazyPage(() => import("./pages/TranslatePage.jsx"));
const DemoStartPage = lazyPage(() => import("./pages/DemoStartPage.jsx"));
const CheckinPage = lazyPage(() => import("./pages/CheckinPage.jsx"));
const TeacherApp = lazyPage(() => import("./teacher/TeacherApp.jsx"));
const AdminTeachersPage = lazyPage(() => import("./pages/admin/AdminTeachersPage.jsx"));
const AdminLessonRoutes = lazyPage(() => import("./pages/admin/AdminLessonRoutes.jsx"));

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

/** Teacher accounts get their own small app; everyone else the class app. */
function AppRoutes() {
  const { isTeacher } = useAuth();
  if (isTeacher) {
    return (
      <Suspense fallback={<PageLoading />}>
        <TeacherApp />
      </Suspense>
    );
  }
  return (
    <>
      <CatalogProvider>
      <TasksProvider>
      <UnreadProvider>
      <GpaProvider>
        <Suspense fallback={<PageLoading />}>
        <Routes>
          {/* Public guest overview: counts only, no content */}
          <Route path="guest" element={<GuestPage />} />
          <Route path="demo" element={<DemoStartPage />} />

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
              <Route path="teachers" element={<TeachersPage />} />
              <Route path="search" element={<SearchPage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="campus" element={<CampusPage />} />
              <Route path="notes" element={<NotesPage />} />
              <Route path="quiz" element={<QuizPage />} />
              <Route path="notes/:id" element={<NotePage />} />
              <Route path="draw" element={<DrawPage />} />
              <Route path="suggestions" element={<SuggestionsPage />} />
              <Route path="translate" element={<TranslatePage />} />
              <Route path="checkin" element={<CheckinPage />} />
              <Route path="courses/:slug" element={<CourseDetailPage />} />
              <Route element={<RequireAdmin />}>
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<AdminStudentsPage />} />
                  <Route path="schedule" element={<AdminSchedulePage />} />
                  <Route path="overview" element={<AdminOverviewPage />} />
                  <Route path="teachers" element={<AdminTeachersPage />} />
                  <Route path="teachers/*" element={<AdminLessonRoutes />} />
                </Route>
              </Route>
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          </Route>
        </Routes>
        </Suspense>
      </GpaProvider>
      </UnreadProvider>
      </TasksProvider>
      </CatalogProvider>
    </>
  );
}
