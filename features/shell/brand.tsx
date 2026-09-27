import { Box } from "lucide-react";

export function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1.5">
      <span className="flex size-[30px] items-center justify-center rounded-[9px] bg-accent text-white">
        <Box size={17} strokeWidth={2} aria-hidden />
      </span>
      <span className="text-xl font-bold tracking-[-0.02em]">spacie</span>
    </div>
  );
}
