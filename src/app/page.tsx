import { redirect } from "next/navigation";

// Root just forwards to the projects list; middleware handles the
// "not logged in -> /login" redirect before this ever runs.
export default function Home() {
  redirect("/projects");
}
