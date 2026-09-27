import type { MenuItem } from "@/components/ui/dropdown-menu";
import type { FileMeta } from "@/lib/types";
import type { Controller } from "@/features/workspace/use-controller";

/** The row menu shared by the desktop table and the mobile list. */
export function fileActions(ctl: Controller, f: FileMeta): MenuItem[] {
  return [
    { label: "Open", onSelect: () => ctl.openFile(f) },
    { label: "Share…", onSelect: () => ctl.shareOne(f) },
    { label: "Copy link", onSelect: () => void ctl.copyLink(f) },
    {
      label: "Rename",
      onSelect: () => {
        ctl.setSelected(f.id);
        ctl.dialog("rename", f.name);
      },
    },
    {
      label: "Move to trash",
      danger: true,
      onSelect: () => {
        ctl.setSelected(f.id);
        ctl.dialog("delete");
      },
    },
  ];
}
