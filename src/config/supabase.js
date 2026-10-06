// Public Supabase connection settings.
//
// These two values are PUBLIC by design: every visitor's browser receives them.
// Data is protected by Row Level Security in the database, not by hiding this key.
// NEVER put the service-role / secret key in front-end code.

export const SUPABASE_URL = "https://lxrjogpmmatpuzellnyu.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_fnfShtPMuOUc2g3CNX-ydA_PAob-rU6";

// Internal login emails. They never receive mail; students only see their code.
export const STUDENT_EMAIL_DOMAIN = "students.kainar.online";
