import { redirect } from "next/navigation";

/**
 * Root page — redirects to the login page.
 * Once auth is implemented, authenticated users will be redirected to /dashboard.
 */
export default function Home() {
  redirect("/login");
}
