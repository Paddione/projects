import { IFile, ICharacter } from "./character";
import { IItem } from "./item";
import { IMercenary } from "./mercenary";

export interface ICharacterData {
  file: IFile;
  character: ICharacter;
  mercenary: IMercenary;
  items: IItem[];
  season: number;
}
