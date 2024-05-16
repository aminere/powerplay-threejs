
export const resourceConfig = {
    rawResources: {
        "stone": {
            capacity: 100
        },
        "coal": {
            capacity: 100
        },
        "iron-ore": {
            capacity: 100
        },
        "sulfur": {
            capacity: 100
        },
        "oil": {
            capacity: 1
        },
        "copper": {
            capacity: 100
        },
        "wood": {
            capacity: 100
        },
        "water": {
            capacity: 1
        } 
    },

    factoryProduction: {
        "coal": ["wood"] as const,
        "steel": ["iron-ore", "coal"] as const,
        "bullets": ["sulfur"] as const,
        "plastic": ["oil", "coal"] as const,
        "rubber": ["oil", "sulfur"] as const,
        "concrete": ["stone", "iron-ore"] as const,
        "glass": ["stone"] as const,
        "engine": ["steel", "copper"] as const,
        "ak47": ["iron-ore"] as const,
        "gasoline": ["oil"] as const,
        "tire": ["rubber", "iron-ore"] as const
    },

    assemblyProduction: {
        "truck": [            
            ["steel", 1],
            ["engine", 1],
            ["tire", 4]
        ] as const,
        "tank": [
            ["steel", 1],
            ["engine", 1]
        ] as const
    },

    incubatorProduction: {
        "worker": [["water", 5]] as const
    }
}


