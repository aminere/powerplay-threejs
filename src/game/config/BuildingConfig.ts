import { Vector3 } from "three";
import { BuildableType } from "../buildings/BuildingTypes";
import { RawResourceType, ResourceType } from "../GameDefinitions";

interface IBuildingConfig {
    size: Vector3;
    buildCost: [RawResourceType | ResourceType, number][];
    hitpoints: number;
}

export const buildingConfig: Record<BuildableType, IBuildingConfig> = {
    "mine": {
        size: new Vector3(3, 2, 3),
        buildCost: [["stone", 3], ["wood", 3]],
        hitpoints: 20
    },
    "factory": {
        size: new Vector3(5, 3, 4),
        buildCost: [["stone", 5], ["wood", 5]],
        hitpoints: 30
    },
    "assembly": {
        size: new Vector3(6, 4, 5),
        buildCost: [["concrete", 5], ["glass", 5]],
        hitpoints: 50
    },
    "incubator": {
        size: new Vector3(1, 3, 1),
        buildCost: [["stone", 3], ["glass", 3]],
        hitpoints: 10
    },
    "depot": {
        size: new Vector3(4, 1, 4),
        buildCost: [["stone", 3]],
        hitpoints: 10
    },
    "train-factory": {
        size: new Vector3(8, 4, 5),
        buildCost: [["concrete", 10], ["glass", 10]],
        hitpoints: 50
    },
    "road": {
        size: null!,
        buildCost: [["concrete", 1]],
        hitpoints: -1
    },
    "conveyor": {
        size: null!,
        buildCost: [["iron-ore", 1]],
        hitpoints: 10
    },
    "rail": {
        size: null!,
        buildCost: [["steel", 1]],
        hitpoints: -1
    }
};

