import { IItem } from "./item";

export interface IMercenary {
  id: number;
  name_id: number;
  type: number;
  experience: number;
  name: string;
  description: string;
  items: IItem[];
}
