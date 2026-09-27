import type { Metadata } from "next";
import { mcpResource } from "@/lib/oauth/metadata";
import { LandingNav } from "@/features/landing/nav";
import { Hero } from "@/features/landing/hero";
import { AgentMarquee, Features, FinalCta, Footer, Problem } from "@/features/landing/sections";
import { HowItWorks } from "@/features/landing/how-it-works";
import { Faq, Pricing } from "@/features/landing/pricing";

// Rendered per request so the MCP URL comes from the running server's SPACIE_ORIGIN
// (the build does not see the service's environment).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Spacie · Your team and your AI agents on the same files",
  description:
    "Claude, Codex or Hermes drop their docs, decks and PDFs straight into your projects. See who changed what, and roll back in one click.",
};

/** Public marketing page. Separate from the app: nothing here reads a workspace. */
export default function Landing() {
  // The connect command shows this server's real MCP endpoint.
  const origin = (process.env.SPACIE_ORIGIN ?? "https://your-domain").replace(/\/$/, "");
  const command = `claude mcp add --transport http spacie ${mcpResource(origin)}`;
  return (
    <div className="landing min-h-dvh overflow-x-clip bg-[#faf9f6] text-ink antialiased">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main" className="block min-h-0">
        <Hero />
        <AgentMarquee />
        <Problem />
        <HowItWorks command={command} />
        <Features />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
