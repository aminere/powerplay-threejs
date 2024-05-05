import { Vector3 } from "three";
import { BuildingType } from "./BuildingTypes";

interface IBuildingConfig {
    size: Vector3;
    buildCost: number;
}

export const buildingConfig: Record<BuildingType, IBuildingConfig> = {
    "mine": {
        size: new Vector3(3, 2, 3),
        buildCost: 3
    },
    "factory": {
        size: new Vector3(5, 3, 4),
        buildCost: 5
    },
    "assembly": {
        size: new Vector3(6, 4, 5),
        buildCost: 10
    },
    "incubator": {
        size: new Vector3(1, 3, 1),
        buildCost: 2
    },
    "depot": {
        size: new Vector3(4, 1, 4),
        buildCost: 3
    },
    "train-factory": {
        size: new Vector3(8, 4, 5),
        buildCost: 15
    }
};

