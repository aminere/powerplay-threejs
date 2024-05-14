import { Vector3 } from "three";

export const config = {
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
        atlasTileCount: 35,
        liquidDepths: {
            "water": [5, .2], // [depth, surface]
            "oil": [2, .1]
        }
    },
    game: {
        cellSize: 1,
        cellsPerRoadBlock: 2,
        mapRes: 32,
        elevationStep: .2,
        unitScale: .7,
        truckScale: 1.7,
        tankScale: 2
    },
    incubators: {
        inputCapacity: 5,        
        productionTime: 10,
        inputAccepFrequency: 1        
    },
    assemblies: {
        inputCapacity: 5,        
        productionTime: 2,
        inputAccepFrequency: 1
    },    
    factories: {
        inputCapacity: 5,
        productionTime: 2,
        inputAccepFrequency: 1
    },
    mines: {
        productionTime: 2,    
    },
    depots: {
        range: 10,
    },
    conveyors: {
        itemSize: .5, // relative to the cell
        itemScale: .7,
        width: .8,
        height: .34,
        maxCount: 500,
        speed: 1,
    },
    trains: {
        maxSpeed: 40,
        acceleration: 1,
        deceleration: -3,
        scale: 2.3
    },
    trucks: {
        slotCount: 3,
        resourcesPerSlot: 5,
        slotStart: new Vector3(0, .36, -.7),
        slotSpacing: .35,
        slotScaleRange: [.3, .6],
        transferFrequency: 1
    },
    steering: {
        maxForce: 60,
        maxSpeed: 5,
        separations: {
            "worker": .7,
            "enemy-melee": .7,
            "enemy-ranged": .7,
            "tank": 4,
            "truck": 4,
        }
    }
};

