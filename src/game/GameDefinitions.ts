
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

export type UIType = "gamemap";
export type Action = typeof Actions[number];
export type TileType = typeof TileTypes[number];
export type ResourceType = typeof ResourceTypes[number];
export type MineralType = typeof MineralTypes[number];

