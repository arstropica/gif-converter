import React from "react";

import { cn } from "@/lib/utils";

type BarColor = "teal" | "orange" | "red" | "blue" | "empty";

const colorClassMap: Record<BarColor, string> = {
  teal: "bg-tealBar",
  orange: "bg-orangeBar",
  red: "bg-redBar",
  blue: "bg-blueBar",
  empty: "bg-emptyBar",
};

interface SegmentedProgressBarProps {
  percent?: number;
  className?: string;
  segments: Record<number, BarColor>;
}

export const SegmentedProgressBar: React.FC<SegmentedProgressBarProps> = ({
  className,
  percent,
  segments,
}) => {
  const steps = Object.keys(segments).map(Number);
  steps.sort();
  const widths = steps.reduce((acc, step, idx, arr) => {
    if (idx < arr.length - 1) acc.push(arr[idx + 1] - step);
    else acc.push(100 - step);
    return acc;
  }, [] as number[]);
  const getColorFor = (p: number) => {
    let colorKey: keyof typeof colorClassMap = "empty";
    for (const threshold of steps) {
      if (p >= threshold) {
        colorKey = segments[threshold];
      }
    }
    return colorClassMap[colorKey] || colorClassMap.empty;
  };

  return (
    <div className={cn("flex h-4 gap-1 bg-track/10 p-1 rounded", className)}>
      {steps.map((step, idx) => {
        const threshold = Number(step);
        const color = getColorFor(threshold);
        const isFilled = percent !== undefined && percent >= threshold;
        const filledPercent =
          percent !== undefined
            ? Math.min(
                Math.max(((percent - threshold) / widths[idx]) * 100, 0),
                100,
              )
            : 0;

        return (
          <div
            key={idx}
            className="bg-emptyBar rounded relative h-full"
            style={{ width: `${widths[idx]}%` }}
          >
            <div
              className={cn(
                "flex-1 bg-tealBar h-full rounded p-1",
                isFilled ? color : colorClassMap.empty,
              )}
              style={{
                width: `${isFilled ? filledPercent : 0}%`,
                transition: "width 0.3s ease",
              }}
            />
          </div>
        );
      })}
    </div>
  );
};

SegmentedProgressBar.displayName = "SegmentedProgressBar";
export default SegmentedProgressBar;
