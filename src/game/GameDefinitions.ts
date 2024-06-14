

export const Actions = [
    "elevation",     
    "flatten",
    "building", 
    "unit",
    "train",
    "resource",
    "destroy"
] as const;

export const TileTypes = [
    "sand", 
    "grass",
    "rock"
] as const;

export const MineralTypes = [
    "stone",
    "coal",
    "iron",
] as const;

export const RawResourceTypes = [
    ...MineralTypes,
    "wood",
    "water",
    "oil"
] as const;

export const ResourceTypes = [
    "charcoal",
    "steel",
    "rubber",
    "concrete",
    "glass",
    "ak47",
    "rpg"
] as const;

export const CharacterTypes = [
    "worker",
    "enemy-melee",
    "enemy-ranged",
] as const;

export const VehicleTypes = [
    "truck",
    "tank",
    "enemy-tank"
] as const;

export const UnitTypes = [
    ...CharacterTypes,
    ...VehicleTypes
] as const;

export const ElevationTypes = [
    "increase",
    "decrease"
] as const;

export type UIType = "gamemap" | "mainmenu";
export type Action = typeof Actions[number];
export type TileType = typeof TileTypes[number];
export type RawResourceType = typeof RawResourceTypes[number];
export type MineralType = typeof MineralTypes[number];
export type ResourceType = typeof ResourceTypes[number];
export type CharacterType = typeof CharacterTypes[number];
export type UnitType = typeof UnitTypes[number];
export type VehicleType = typeof VehicleTypes[number];
export type ElevationType = typeof ElevationTypes[number];


