
export const Actions = [
    "elevation",     
    "terrain",
    "water",
    "flatten",
    "road", 
    "building", 
    "rail", 
    "belt",
    "unit",
    "train",
    "resource",
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
    "wood",
] as const;

export const ResourceTypes = [
    "rubber",
    "plastic",
    "steel",
    "wheel",
    "engine",
    "truck-frame",
    "ak47",
    "tire"
] as const;

export const ProductTypes = [
    "truck",
] as const;

export const CharacterTypes = [
    "worker",
    "enemy-melee",
    "enemy-ranged",
] as const;

export const VehicleTypes = [
    "truck",
    "tank"
] as const;

export const UnitTypes = [
    ...CharacterTypes,
    ...VehicleTypes
] as const;

export type UIType = "gamemap";
export type Action = typeof Actions[number];
export type TileType = typeof TileTypes[number];
export type RawResourceType = typeof RawResourceTypes[number];
export type MineralType = typeof MineralTypes[number];
export type ResourceType = typeof ResourceTypes[number];
export type ProductType = typeof ProductTypes[number];
export type CharacterType = typeof CharacterTypes[number];
export type UnitType = typeof UnitTypes[number];
export type VehicleType = typeof VehicleTypes[number];

