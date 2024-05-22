import { RawResourceType, ResourceType } from "../GameDefinitions"

type FactoryProduction = Record<ResourceType, Array<ResourceType | RawResourceType>>;
const factoryProduction: FactoryProduction = {
    "charcoal": ["wood"],
    "steel": ["iron-ore", "coal"],
    "rubber": ["oil"],
    "concrete": ["stone", "iron-ore"],
    "glass": ["stone"],
    "ak47": ["iron-ore"]
};

type RawResourceConfig = Record<RawResourceType, { capacity: number }>;
const rawResources: RawResourceConfig = {
    "stone": {
        capacity: 100
    },
    "coal": {
        capacity: 100
    },
    "iron-ore": {
        capacity: 100
    },    
    "oil": {
        capacity: 1
    },    
    "wood": {
        capacity: 100
    },
    "water": {
        capacity: 1
    } 
}

export const resourceConfig = {
    rawResources,
    factoryProduction,

    assemblyProduction: {
        "truck": [            
            ["iron-ore", 1],
            ["rubber", 1]
        ] as const,
        "tank": [
            ["steel", 1],
            ["oil", 1]
        ] as const
    },

    incubatorProduction: {
        "worker": [["water", 5]] as const
    }
}


