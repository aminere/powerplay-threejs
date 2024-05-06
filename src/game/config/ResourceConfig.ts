import { RawResourceType } from "../GameDefinitions";

interface IResourceConfig {
    capacity: number;
}

export const resourceConfig: Record<RawResourceType, IResourceConfig> = {
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
        capacity: 100
    },
    "copper": {
        capacity: 100
    },
    "wood": {
        capacity: 100
    },
    "water": {
        capacity: 100
    }    
};

