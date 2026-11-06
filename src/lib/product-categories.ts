export const availableProductCategories = [
  'knowledge_products',
  'creative_skill_kits',
  'new_ways_of_working_kits',
] as const;

export type ProductCategory = typeof availableProductCategories[number];
