
export const config = {
    camera: {
        rotation: [-30, 45],
        orthoSize: 2,
        zoomRange: [0.3, 8],
        zoomSpeed: .001,
        panMargin: 0.01,
        panSpeed: 6,
        shadowRange: 2
    },
    terrain: {
        atlasTileCount: 35
    },
    game: {
        cellSize: 1,
        mapRes: 32,
        elevationStep: .2,        
    },
    train: {
        maxSpeed: 40,
        acceleration: 1,
        deceleration: -3,       
    },
    pathfinding: {
        cellWaitTime: .3
    }
};
