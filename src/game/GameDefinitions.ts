
export const Actions = [
    "elevation", 
    "terrain",
    "road", 
    "building", 
    "rail", 
    "belt",
    "unit",
    "car",
    "train",
    "mineral",
    "tree"
] as const;

export const TileTypes = [
    "sand", 
    "grass",
    "rock"
] as const;

export const MineralTypes = [
    "carbon",
    "iron-ore",
    "aluminium",
    "scandium",
] as const;

export const RawResourceTypes = [
    ...MineralTypes,
    "wood"
] as const;

export const ResourceTypes = [
    "rubber",
    "plastic",
    "steel",
    "wheel",
    "engine",
    "truck-frame"
] as const;

export const ProductTypes = [
    "truck"
] as const;

export type UIType = "gamemap";
export type Action = typeof Actions[number];
export type TileType = typeof TileTypes[number];
export type RawResourceType = typeof RawResourceTypes[number];
export type MineralType = typeof MineralTypes[number];
export type ResourceType = typeof ResourceTypes[number];
export type ProductType = typeof ProductTypes[number];

