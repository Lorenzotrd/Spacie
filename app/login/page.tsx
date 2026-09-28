import { LoginForm } from "@/features/auth/login-form";
import { googleConfigured } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export default function Login() {
  return <LoginForm google={googleConfigured()} />;
}
