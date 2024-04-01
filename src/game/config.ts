import { Vector3 } from "three";
import { BuildingType } from "./GameDefinitions";

interface ICameraConfig {
    rotation: number[];
    orthoSize: number;
    zoomRange: number[];
    zoomSpeed: number;
    panMargin: number;
    panSpeed: number;
    shadowRange: number;
}

interface ITerrainConfig {
    atlasTileCount: number;
}

interface IGameConfig {
    cellSize: number;
    mapRes: number;
    elevationStep: number;
    conveyorHeight: number;
    conveyorWidth: number;
    maxConveyors: number;
    conveyorSpeed: number;
}

interface ITrainConfig {
    maxSpeed: number;
    acceleration: number;
    deceleration: number;
}

interface IPathfindingConfig {
    cellWaitTime: number;
}

interface IBuildingConfig {
    size: Vector3;
}

interface IConfig {
    camera: ICameraConfig;
    terrain: ITerrainConfig;
    game: IGameConfig;
    train: ITrainConfig;
    pathfinding: IPathfindingConfig;
    buildings: Record<BuildingType, IBuildingConfig>;
}

export const config: IConfig = {
    camera: {
        rotation: [-30, 45],
        orthoSize: 10,
        zoomRange: [0.3, 8],
        zoomSpeed: .001,
        panMargin: 0.01,
        panSpeed: 30,
        shadowRange: 2
    },
    terrain: {
        atlasTileCount: 35
    },
    game: {
        cellSize: 2,
        mapRes: 32,
        elevationStep: .2,
        conveyorHeight: .3,
        conveyorWidth: .6,        
        maxConveyors: 500,
        conveyorSpeed: 2
    },
    train: {
        maxSpeed: 40,
        acceleration: 1,
        deceleration: -3,       
    },
    pathfinding: {
        cellWaitTime: .3
    },
    buildings: {
        "hq": {
            size: new Vector3(10, 4, 5)
        },
        "mine": {
            size: new Vector3(2, 2, 3)
        },
        "factory": {
            size: new Vector3(2, 2, 3)
        },
        "assembly": {
            size: new Vector3(2, 2, 3)
        }
    }
};

