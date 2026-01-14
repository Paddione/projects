import { Table, Title, UnstyledButton } from "@mantine/core";
import { IconChevronUp, IconChevronDown } from "@tabler/icons-react";
import type { SortableTableHeaderProps } from "../../../types";

export function SortableTableHeader({
  children,
  sorted,
  onSort,
}: SortableTableHeaderProps) {
  const Icon = sorted === "asc" ? IconChevronUp : IconChevronDown;

  return (
    <Table.Th>
      <UnstyledButton
        onClick={onSort}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          cursor: "pointer",
        }}
      >
        <Title order={6}>{children}</Title>
        {sorted && <Icon size={14} style={{ opacity: 0.5 }} />}
      </UnstyledButton>
    </Table.Th>
  );
}
