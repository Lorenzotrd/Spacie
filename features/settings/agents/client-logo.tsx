import NextImage from "next/image";
import { cn } from "@/components/ui/cn";
import type { ClientGuide } from "./catalog";

/** The client's logo on a light tile; a small green dot once one of its agents is connected. */
export function ClientLogo({ client, connected, size = "md" }: { client: ClientGuide; connected: boolean; size?: "md" | "sm" | "lg" }) {
  const scale = size === "lg" ? 1.2 : size === "sm" ? 0.85 : 1;
  const px = Math.round(client.logo.size * scale);
  return (
    <span
      aria-hidden
      className={cn(
        "relative flex shrink-0 items-center justify-center border border-[#eceae4] bg-subtle",
        size === "lg" ? "size-12 rounded-[0.875rem]" : size === "sm" ? "size-9 rounded-[0.625rem]" : "size-10 rounded-[0.6875rem]",
      )}
    >
      <NextImage src={client.logo.src} alt="" width={px} height={px} unoptimized className="object-contain" style={{ width: px, height: px }} />
      {connected && (
        <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-online" />
      )}
    </span>
  );
}
