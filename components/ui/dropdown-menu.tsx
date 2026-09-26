"use client";
import { DropdownMenu as Menu } from "radix-ui";
import { MoreHorizontal } from "lucide-react";
import { cn } from "./cn";

export type MenuItem = { label: string; onSelect: () => void; danger?: boolean };

export function FileMenu({
  items,
  label = "File actions",
  touch = false,
}: {
  items: MenuItem[];
  /** Accessible name of the trigger, e.g. "Actions for Deck.pptx". */
  label?: string;
  /** 44px trigger for touch screens. */
  touch?: boolean;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label={label}
        className={cn(
          "inline-flex items-center justify-center rounded-lg text-muted hover:bg-segment focus-visible:outline-2 focus-visible:outline-accent",
          touch ? "size-11" : "size-8",
        )}
      >
        <MoreHorizontal size={17} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={5} className="dropdown-content">
          {items.map((i) => (
            <Menu.Item key={i.label} className={`dropdown-item ${i.danger ? "danger" : ""}`} onSelect={i.onSelect}>
              {i.label}
            </Menu.Item>
          ))}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
