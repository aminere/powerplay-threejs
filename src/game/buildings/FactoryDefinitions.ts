import { RawResourceType, ResourceType } from "../GameDefinitions";

export const FactoryDefinitions: Record<ResourceType, Array<ResourceType | RawResourceType>> = {
    "coal": ["wood"],
    "steel": ["iron-ore", "coal"],
    "gunpowder": ["sulfur"],
    "plastic": ["oil", "coal"],
    "rubber": ["oil", "sulfur"],
    "concrete": ["stone", "iron-ore"],
    "glass": ["stone"],
    "engine": ["steel", "copper"],
    "ak47": ["iron-ore", "gunpowder"],
    "gasoline": ["oil"],
    "tire": ["rubber", "iron-ore"]
}

