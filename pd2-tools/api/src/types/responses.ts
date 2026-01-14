import { ICharacter } from "./character";
import { IItem } from "./item";
import { IMercenary } from "./mercenary";

export interface CharacterResponse {
  character: ICharacter | null;
  mercenary?: unknown;
  items: IItem[] | null;
  nullReason?: string;
}

export interface CharacterData {
  character: ICharacter;
  mercenary?: IMercenary;
  items: IItem[];
}
