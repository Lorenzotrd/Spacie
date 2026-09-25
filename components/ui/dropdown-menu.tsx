"use client";
import { DropdownMenu as Menu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
export function FileMenu({
  items,
}: {
  items: { label: string; onSelect: () => void; danger?: boolean }[];
}) {
  return (
    <Menu.Root>
      <Menu.Trigger className="icon-button row-menu" aria-label="File actions">
        <MoreHorizontal size={17} />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={5} className="dropdown-content">
          {items.map((i) => (
            <Menu.Item
              key={i.label}
              className={`dropdown-item ${i.danger ? "danger" : ""}`}
              onSelect={i.onSelect}
            >
              {i.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
