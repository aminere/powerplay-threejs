import { Vector3 } from "three";
import { BuildingType } from "../buildings/BuildingTypes";

interface IBuildingConfig {
    size: Vector3;
    buildCost: number;
    hitpoints: number;
}

export const buildingConfig: Record<BuildingType, IBuildingConfig> = {
    "mine": {
        size: new Vector3(3, 2, 3),
        buildCost: 3,
        hitpoints: 20
    },
    "factory": {
        size: new Vector3(5, 3, 4),
        buildCost: 5,
        hitpoints: 30
    },
    "assembly": {
        size: new Vector3(6, 4, 5),
        buildCost: 10,
        hitpoints: 50
    },
    "incubator": {
        size: new Vector3(1, 3, 1),
        buildCost: 2,
        hitpoints: 10
    },
    "depot": {
        size: new Vector3(4, 1, 4),
        buildCost: 3,
        hitpoints: 10
    },
    "train-factory": {
        size: new Vector3(8, 4, 5),
        buildCost: 15,
        hitpoints: 50
    }
};

