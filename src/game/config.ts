
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
    unitScale: number;
    truckScale: number;
}

interface IConveyorConfig {
    itemSize: number;
    itemScale: number;
    width: number;
    height: number;
    maxCount: number;
    speed: number;
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
    conveyors: IConveyorConfig;
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
        cellsPerRoadBlock: 4,
        mapRes: 32,
        elevationStep: .2,
        unitScale: 1,
        truckScale: 2.5
    },
    conveyors: {
        itemSize: .5, // relative to the cell
        itemScale: 1,
        width: .8,
        height: .34,
        maxCount: 500,
        speed: 1
    },
    train: {
        maxSpeed: 40,
        acceleration: 1,
        deceleration: -3,
        scale: 3
    },
    pathfinding: {
        cellWaitTime: .3
    }    
};

