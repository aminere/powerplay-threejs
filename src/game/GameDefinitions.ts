
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

export const ResourceTypes = [
    ...MineralTypes,
    "tree"
] as const;

const IntermediateTypes = [
    "rubber",
    "plastic",
    "steel",
    "wheel",
    "engine",
    "truck-frame"
] as const;

const ProductTypes = [
    "truck"
] as const;

export const BuildingTypes = [
    "hq",
    "mine",
    "factory",
    "assembly"
] as const;

export type UIType = "gamemap";
export type Action = typeof Actions[number];
export type TileType = typeof TileTypes[number];
export type ResourceType = typeof ResourceTypes[number];
export type MineralType = typeof MineralTypes[number];
export type BuildingType = typeof BuildingTypes[number];

