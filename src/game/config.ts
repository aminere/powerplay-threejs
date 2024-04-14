
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
    cellsPerRoadBlock: number;
    mapRes: number;
    elevationStep: number;
    conveyorHeight: number;
    conveyorWidth: number;
    maxConveyors: number;
    conveyorSpeed: number;
    unitScale: number;
    truckScale: number;
}

interface ITrainConfig {
    maxSpeed: number;
    acceleration: number;
    deceleration: number;
    scale: number;
}

interface IPathfindingConfig {
    cellWaitTime: number;
}


interface IConfig {
    camera: ICameraConfig;
    terrain: ITerrainConfig;
    game: IGameConfig;
    train: ITrainConfig;
    pathfinding: IPathfindingConfig;
}

export const config: IConfig = {
    camera: {
        rotation: [-30, 45],
        orthoSize: 10,
        zoomRange: [0.3, 8],
        zoomSpeed: .001,
        panMargin: 0.01,
        panSpeed: 30,
        shadowRange: 1.5
    },
    terrain: {
        atlasTileCount: 35
    },
    game: {
        cellSize: 1,
        cellsPerRoadBlock: 2,
        mapRes: 32,
        elevationStep: .2,
        conveyorHeight: .34,
        conveyorWidth: .8,
        maxConveyors: 500,
        conveyorSpeed: 1,
        unitScale: .7,
        truckScale: 2.5
    },
    train: {
        maxSpeed: 40,
        acceleration: 1,
        deceleration: -3,
        scale: 2
    },
    pathfinding: {
        cellWaitTime: .3
    }    
};

