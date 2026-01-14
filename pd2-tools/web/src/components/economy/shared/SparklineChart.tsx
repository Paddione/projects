import { Box, useMantineTheme } from "@mantine/core";
import { AreaChart, Area } from "recharts";
import type { SparklineChartProps } from "../../../types";

export function SparklineChart({ data }: SparklineChartProps) {
  const theme = useMantineTheme();

  if (!data || data.length === 0) {
    return <Box w={100} h={30} />;
  }

  return (
    <AreaChart
      width={100}
      height={30}
      data={data}
      margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
    >
      <Area
        type="monotone"
        dataKey="price"
        stroke={theme.colors.blue[6]}
        fill={theme.colors.blue[6]}
        fillOpacity={0.2}
        strokeWidth={2}
        isAnimationActive={false}
      />
    </AreaChart>
  );
}
