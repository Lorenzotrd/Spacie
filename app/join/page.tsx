import { JoinForm } from "@/features/auth/join-form";
import { googleConfigured } from "@/lib/google-auth";

export const dynamic = "force-dynamic";

export default function Join() {
  return <JoinForm google={googleConfigured()} />;
}
