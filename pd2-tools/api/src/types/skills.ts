export interface SkillDefinition {
  name: string;
  categories: string[];
}

export interface SkillBonus {
  type: "direct" | "tree" | "all" | "class" | "elemental";
  amount: number;
  target: string;
  source: string;
}
