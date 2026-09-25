import { boundedRequest } from "@/lib/http";
import { authClient, assertSameOrigin } from "@/lib/auth";
import { demo } from "@/lib/repository";
import { z } from "zod";
import { failure } from "@/lib/http";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (demo()) throw new Error("Sign-in is not needed in local demo mode.");
    const { email } = z
      .object({ email: z.string().email() })
      .parse(await (await boundedRequest(request, 10000)).json());
    const { error } = await (
      await authClient()
    ).auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${process.env.SPACIE_ORIGIN}/api/auth/callback`,
      },
    });
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (e) {
    return failure(e);
  }
}
