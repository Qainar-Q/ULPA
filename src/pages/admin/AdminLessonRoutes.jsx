import { Route, Routes } from "react-router-dom";
import { CheckinRoute, CourseRoute, RollRoute } from "../../teacher/LessonRoutes.jsx";

const BASE = "/admin/teachers";

/** The admin can open any lesson or course exactly like its teacher. */
export default function AdminLessonRoutes() {
  return (
    <Routes>
      <Route path="lesson/:entryId/:date" element={<RollRoute base={BASE} />} />
      <Route path="lesson/:entryId/:date/qr" element={<CheckinRoute base={BASE} />} />
      <Route path="course/:courseId" element={<CourseRoute base={BASE} />} />
    </Routes>
  );
}
