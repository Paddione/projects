import React from "react";
import { Box, Text } from "@mantine/core";

interface CustomBreadcrumbsProps {
  separator?: string | React.ReactNode;
  children: React.ReactNode;
}

export function CustomBreadcrumbs({
  separator = ">",
  children,
}: CustomBreadcrumbsProps) {
  const validChildren = React.Children.toArray(children).filter(Boolean);

  return (
    <Box style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}>
      {validChildren.map((child, index) => (
        <React.Fragment key={index}>
          {child}
          {index < validChildren.length - 1 && (
            <Text
              size="sm"
              style={{
                margin: `0 ${typeof separator === "string" ? "8px" : "0"}`,
              }}
            >
              {separator}
            </Text>
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}
