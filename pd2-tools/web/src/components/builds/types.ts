import type { CharacterFilters, CharacterData } from "../../hooks";

export interface BuildsFiltersProps {
  filters: CharacterFilters;
  updateFilters: (updates: Partial<CharacterFilters>) => void;
}

export interface BuildsDataProps {
  data: CharacterData;
}

export interface BuildsComponentProps
  extends BuildsFiltersProps, BuildsDataProps {}
