import { useState, useEffect, useMemo, useCallback } from "react";
import { useInterval } from "usehooks-ts";
import TerrorZoneCalculator from "../components/layout/NavBar/TerrorZoneCalculator";
import type {
  CurrentZone,
  NextZone,
  TerrorZoneDisplay,
  NextZoneDisplay,
} from "../types";

export function useTerrorZone() {
  const terrorZoneCalc = useMemo(() => new TerrorZoneCalculator(), []);

  const formatMinutes = useMemo(() => {
    return (totalSeconds: number): string => {
      if (totalSeconds < 0) totalSeconds = 0;
      const minutes = Math.floor(totalSeconds / 60);
      return `${minutes}m`;
    };
  }, []);

  const getFreshTerrorData = useCallback(() => {
    const current: CurrentZone = terrorZoneCalc.getCurrentZone();
    const nextZonesRaw: NextZone[] = terrorZoneCalc.getNextXZones(5);
    return {
      currentDisplay: {
        zone: current.zone,
        min: formatMinutes(current.secondsUntilNext),
      },
      nextFive: nextZonesRaw.map((nz) => ({
        zone: nz.zone,
        minutesUntil: formatMinutes(nz.secondsUntilActive),
      })),
    };
  }, [terrorZoneCalc, formatMinutes]);

  const [currentZoneDisplay, setCurrentZoneDisplay] =
    useState<TerrorZoneDisplay>(() => getFreshTerrorData().currentDisplay);
  const [nextFiveZones, setNextFiveZones] = useState<NextZoneDisplay[]>(
    () => getFreshTerrorData().nextFive
  );

  const updateTerrorZoneData = useCallback(() => {
    const freshData = getFreshTerrorData();
    setCurrentZoneDisplay(freshData.currentDisplay);
    setNextFiveZones(freshData.nextFive);
  }, [getFreshTerrorData]);

  // Update terror zone data every 10 seconds
  useInterval(() => {
    updateTerrorZoneData();
  }, 10_000);

  // Initial fetch
  useEffect(() => {
    updateTerrorZoneData();
  }, [updateTerrorZoneData]);

  return { currentZoneDisplay, nextFiveZones };
}
