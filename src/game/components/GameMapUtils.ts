import { Box2, Camera, Vector2 } from "three";
import { pools } from "../../engine/core/Pools";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { engine } from "../../engine/Engine";
import { gameMapState } from "./GameMapState";
import { Elevation } from "../Elevation";
import { MineralType, TileType, TileTypes } from "../GameDefinitions";
import { ICell } from "../GameTypes";
import { roads } from "../Roads";
import { Rails } from "../Rails";
import { resources } from "../Resources";
import { Sector } from "../Sector";
import { buildings } from "../Buildings";
import { conveyors } from "../Conveyors";
import { engineState } from "../../engine/EngineState";
import { Car } from "./Car";
import { utils } from "../../engine/Utils";
import { Train } from "./Train";
import { GameMapProps } from "./GameMapProps";

const { elevationStep, cellSize, mapRes } = config.game;
export function pickSectorTriangle(sectorX: number, sectorY: number, screenPos: Vector2, camera: Camera) {
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorX},${sectorY}`);
    if (!sector) {
        return -1;
    }
    let selectedVertexIndex = -1;
    const plane = pools.plane.getOne();
    const triangle = pools.triangle.getOne();
    const line = pools.line3.getOne();
    const [rayEnd, v1, v2, v3, intersection] = pools.vec3.get(5);
    const normalizedPos = pools.vec2.getOne();
    const { width, height } = engine.screenRect;
    normalizedPos.set((screenPos.x / width) * 2 - 1, -(screenPos.y / height) * 2 + 1);
    GameUtils.rayCaster.setFromCamera(normalizedPos, camera);
    const { ray } = GameUtils.rayCaster;
    rayEnd.copy(ray.origin).addScaledVector(ray.direction, 100);
    line.set(ray.origin, rayEnd);
    const geometry = (sector.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
    const position = geometry.getAttribute("position") as THREE.BufferAttribute;
    const indices = geometry.getIndex()!.array;
    const mapSize = mapRes * cellSize;
    const offset = -mapSize / 2;
    const sectorOffsetX = sectorX * mapSize + offset;
    const sectorOffsetY = sectorY * mapSize + offset;
    let distToClosestIntersection = Infinity;
    for (let i = 0; i < indices.length; i += 3) {
        const i1 = indices[i];
        const i2 = indices[i + 1];
        const i3 = indices[i + 2];
        v1.set(sectorOffsetX + position.getX(i1), position.getY(i1) * elevationStep, sectorOffsetY + position.getZ(i1));
        v2.set(sectorOffsetX + position.getX(i2), position.getY(i2) * elevationStep, sectorOffsetY + position.getZ(i2));
        v3.set(sectorOffsetX + position.getX(i3), position.getY(i3) * elevationStep, sectorOffsetY + position.getZ(i3));
        plane.setFromCoplanarPoints(v1, v2, v3);
        if (plane.normal.dot(ray.direction) < 0) {
            if (plane.intersectLine(line, intersection)) {
                triangle.set(v1, v2, v3);
                if (triangle.containsPoint(intersection)) {
                    const dist = intersection.distanceTo(ray.origin);
                    if (dist < distToClosestIntersection) {
                        distToClosestIntersection = dist;
                        selectedVertexIndex = i;
                    }
                }
            }
        }
    }
    return selectedVertexIndex;
}

export function raycastOnCells(screenPos: Vector2, camera: Camera, cellCoordsOut: Vector2, sectorCoordsOut?: Vector2) {
    const intersection = pools.vec3.getOne();
    if (!GameUtils.screenCastOnPlane(camera, screenPos, 0, intersection)) {
        return null;
    }
    GameUtils.worldToMap(intersection, cellCoordsOut);

    const sectorCoords = sectorCoordsOut ?? pools.vec2.getOne();
    let cell = GameUtils.getCell(cellCoordsOut, sectorCoords);
    let sectorX = sectorCoords.x;
    let sectorY = sectorCoords.y;
    let selectedVertexIndex = cell ? pickSectorTriangle(sectorX, sectorY, screenPos, camera) : -1;

    if (selectedVertexIndex < 0 && cell) {
        // check neighboring sectors, from closest to farthest
        const neighborSectors = new Array<[number, number]>();
        const { sectors } = gameMapState;
        for (const offsetY of [-1, 0, 1]) {
            for (const offsetX of [-1, 0, 1]) {
                if (offsetX === 0 && offsetY === 0) {
                    continue;
                }
                const neighborKey = `${sectorX + offsetX},${sectorY + offsetY}`;
                const neighborSector = sectors.get(neighborKey);
                if (neighborSector) {
                    neighborSectors.push([sectorX + offsetX, sectorY + offsetY]);
                }
            }
        }
        const halfRes = mapRes / 2;
        neighborSectors.sort((a, b) => {
            const aCenterX = a[0] * mapRes + halfRes;
            const aCenterY = a[1] * mapRes + halfRes;
            const cellToSectorDistA = Math.abs(aCenterX - cellCoordsOut.x) + Math.abs(aCenterY - cellCoordsOut.y);
            const bCenterX = b[0] * mapRes + halfRes;
            const bCenterY = b[1] * mapRes + halfRes;
            const cellToSectorDistB = Math.abs(bCenterX - cellCoordsOut.x) + Math.abs(bCenterY - cellCoordsOut.y);
            return cellToSectorDistA - cellToSectorDistB;
        });
        for (const [x, y] of neighborSectors) {
            selectedVertexIndex = pickSectorTriangle(x, y, screenPos, camera);
            if (selectedVertexIndex >= 0) {
                sectorX = x;
                sectorY = y;
                break;
            }
        }
    }

    if (selectedVertexIndex >= 0) {
        const selectedCell = Math.floor(selectedVertexIndex / 6);
        cellCoordsOut.set(
            sectorX * mapRes + selectedCell % mapRes,
            sectorY * mapRes + Math.floor(selectedCell / mapRes)
        );
        sectorCoords.set(sectorX, sectorY);
        cell = gameMapState.sectors.get(`${sectorX},${sectorY}`)!.cells[selectedCell];
    }

    return cell;
}

export function onDrag(start: Vector2, current: Vector2) { // map coords

    switch (gameMapState.action) {
        case "road": {
            gameMapState.previousRoad.forEach(road => roads.clear(road));
            gameMapState.previousRoad.length = 0;
            roads.onDrag(start, current, gameMapState.previousRoad, gameMapState.initialDragAxis!);
        }
            break;

        case "rail": {
            gameMapState.previousRail.forEach(Rails.clear);
            gameMapState.previousRail.length = 0;
            Rails.onDrag(start, current, gameMapState.initialDragAxis!, gameMapState.previousRail);

        } break;

        case "belt": {
            gameMapState.previousConveyors.forEach(cell => conveyors.clear(cell));
            gameMapState.previousConveyors.length = 0;
            conveyors.onDrag(start, current, gameMapState.initialDragAxis!, gameMapState.previousConveyors);

        } break;
    }
}

export function onBeginDrag(start: Vector2, current: Vector2) { // map coords
    if (start.x === current.x) {
        gameMapState.initialDragAxis = "z";
    } else if (start.y === current.y) {
        gameMapState.initialDragAxis = "x";
    } else {
        if (current.y < start.y) {
            gameMapState.initialDragAxis = "x";
        } else {
            gameMapState.initialDragAxis = "z";
        }
    }

    if (gameMapState.action === "rail") {
        const neighborCoord = pools.vec2.getOne();
        for (const offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            neighborCoord.set(start.x + offset[0], start.y + offset[1]);
            const neighbor = GameUtils.getCell(neighborCoord);
            const rail = neighbor?.rail
            if (rail) {
                gameMapState.initialDragAxis = rail.axis;
                break;
            }
        }
    }

    onDrag(start, current);
}

export function onEndDrag() {
    if (gameMapState.previousRoad.length > 0) {
        gameMapState.previousRoad.length = 0;
    }

    if (gameMapState.previousRail.length > 0) {
        Rails.onEndDrag(gameMapState.previousRail);
        gameMapState.previousRail.length = 0;
    }

    if (gameMapState.previousConveyors.length > 0) {
        gameMapState.previousConveyors.length = 0;
    }
}

export function onCancelDrag() {
    gameMapState.previousRoad.forEach(road => roads.clear(road));
    gameMapState.previousRoad.length = 0;
    gameMapState.previousRail.forEach(Rails.clear);
    gameMapState.previousRail.length = 0;
    gameMapState.previousConveyors.forEach(cell => conveyors.clear(cell));
    gameMapState.previousConveyors.length = 0;
}

export function onElevation(mapCoords: Vector2, sectorCoords: Vector2, localCoords: Vector2, radius: Vector2, button: number) {
    if (button === 0) {
        Elevation.elevate(mapCoords, sectorCoords, localCoords, 1, radius);
    } else if (button === 2) {
        Elevation.elevate(mapCoords, sectorCoords, localCoords, -1, radius);
    }
}

export function onRoad(mapCoords: Vector2, cell: ICell, button: number) {
    if (button === 0) {
        if (cell.isEmpty) {
            roads.create(mapCoords);
        }
    } else if (button === 2) {
        if (cell.roadTile !== undefined) {
            roads.clear(mapCoords);
        }
    }
}

export function onBuilding(sectorCoords: Vector2, localCoords: Vector2, cell: ICell, button: number, buildingId: string) {
    if (button === 0) {
        const building = config.buildings[buildingId];
        const allowed = (() => {
            const mapCoords = pools.vec2.getOne();
            for (let i = 0; i < building.size.z; ++i) {
                for (let j = 0; j < building.size.x; ++j) {
                    mapCoords.set(sectorCoords.x * mapRes + localCoords.x + j, sectorCoords.y * mapRes + localCoords.y + i);
                    const _cell = GameUtils.getCell(mapCoords);
                    if (!_cell || !_cell.isEmpty || _cell.hasUnits) {
                        return false;
                    }
                }
            }
            return true;
        })();
        if (allowed) {
            buildings.create(buildingId, sectorCoords, localCoords);
        }

    } else if (button === 2) {
        if (cell.buildingId) {
            buildings.clear(cell.buildingId);
        }
    }
}

export function onMineral(sectorCoords: Vector2, localCoords: Vector2, cell: ICell, button: number, type: MineralType) {
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    if (button === 0) {
        if (cell.isEmpty) {
            resources.create(sector, localCoords, cell, type);
        }
    } else if (button === 2) {
        if (cell.resource) {
            resources.clear(sector, cell);
        }
    }
}

export function onTree(sectorCoords: Vector2, localCoords: Vector2, cell: ICell, button: number) {
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    if (button === 0) {
        if (cell.isEmpty) {
            resources.create(sector, localCoords, cell, "tree");
        }
    } else if (button === 2) {
        if (cell.resource) {
            resources.clear(sector, cell);
        }
    }
}

export function onTerrain(mapCoords: Vector2, tileType: TileType) {
    const [sectorCoords, localCoords] = pools.vec2.get(2);
    GameUtils.getCell(mapCoords, sectorCoords, localCoords)!;
    const terrainTileIndex = TileTypes.indexOf(tileType);
    console.assert(terrainTileIndex >= 0);
    const baseTerrainTileIndex = 32;
    const tileIndex = baseTerrainTileIndex + terrainTileIndex;
    const { sectors } = gameMapState;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    Sector.updateCellTexture(sector, localCoords, tileIndex);
}

export function onConveyor(mapCoords: Vector2, cell: ICell, button: number) {
    if (button === 0) {
        if (cell.isEmpty) {
            conveyors.createAndFit(cell, mapCoords);
        }
    } else if (button === 2) {
        if (cell.conveyor !== undefined) {
            conveyors.clear(mapCoords);
            conveyors.clearLooseCorners(mapCoords);
        }
    }
}

export function createSector(coords: Vector2) {
    const state = gameMapState.instance!;
    const props = GameMapProps.instance;

    const sector = Sector.create({
        sectorX: coords.x,
        sectorY: coords.y,
        continentFreq: props.continentFreq,
        erosionFreq: props.erosionFreq,
        continentWeight: props.continentWeight,
        erosionWeight: props.erosionWeight,
        continentGain: props.continentGain,
        erosionGain: props.erosionGain,
        continent: props.continent.data,
        erosion: props.erosion.data
    });

    state.sectorsRoot.add(sector.root);

    // update bounds
    const { mapRes, cellSize } = config.game;
    const mapSize = mapRes * cellSize;
    const [min, max] = pools.vec2.get(2);
    min.set(sector.root.position.x, sector.root.position.z);
    max.set(min.x + mapSize, min.y + mapSize);
    const { bounds } = state;
    if (!bounds) {
        state.bounds = new Box2(min.clone(), max.clone());
    } else {
        bounds.expandByPoint(min);
        bounds.expandByPoint(max);
    }

    return sector;
}

export function updateCameraBounds() {
    const state = gameMapState.instance!;
    const worldPos = pools.vec3.getOne();
    const [top, right, bottom, left] = state.cameraBounds;
    const mapBounds = state.bounds;
    GameUtils.worldToScreen(worldPos.set(mapBounds!.min.x, 0, mapBounds!.min.y), state.camera, top);
    GameUtils.worldToScreen(worldPos.set(mapBounds!.max.x, 0, mapBounds!.max.y), state.camera, bottom);
    GameUtils.worldToScreen(worldPos.set(mapBounds!.min.x, 0, mapBounds!.max.y), state.camera, left);
    GameUtils.worldToScreen(worldPos.set(mapBounds!.max.x, 0, mapBounds!.min.y), state.camera, right);
    utils.updateDirectionalLightTarget(state.light);
}

export function onClick(touchButton: number) {
    const state = gameMapState.instance!;
    const props = GameMapProps.instance;

    const [sectorCoords, localCoords] = pools.vec2.get(2);
    const cell = GameUtils.getCell(state.selectedCellCoords, sectorCoords, localCoords);
    if (!cell) {
        createSector(sectorCoords.clone());
        updateCameraBounds();
    } else {
        const mapCoords = state.selectedCellCoords;
        switch (state.action) {
            case "elevation": {
                onElevation(mapCoords, sectorCoords, localCoords, state.tileSelector.size, touchButton);
                state.tileSelector.fit(mapCoords);
            }
                break;

            case "terrain": {
                onTerrain(mapCoords, props.tileType);
            }
                break;

            case "road": {
                onRoad(mapCoords, cell, touchButton);
            }
                break;

            case "building": {
                onBuilding(sectorCoords, localCoords, cell, touchButton, props.buildingId);
            }
                break;

            case "mineral": {
                onMineral(sectorCoords, localCoords, cell, touchButton, props.mineralType);
            }
                break;

            case "tree": {
                onTree(sectorCoords, localCoords, cell, touchButton);
            }
                break;

            case "car": {
                if (touchButton === 0) {

                    // TODO
                    // if (!cell.unit) {
                    //     const { sectors, layers } = this.state;
                    //     const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;

                    //     const car = utils.createObject(layers.cars, "car");
                    //     engineState.setComponent(car, new Car({
                    //         coords: this.state.selectedCellCoords.clone()
                    //     }));

                    //     Sector.updateHighlightTexture(sector, localCoords, new Color(0xff0000));
                    //     cell.unit = car;
                    // }

                } else if (touchButton === 2) {
                    const cars = engineState.getComponents(Car);
                    if (cars) {
                        for (const car of cars) {
                            // car.entity.setComponent(GroupMotion, {
                            //     motion: groupMotion
                            // });                             
                            car.component.goTo(state.selectedCellCoords);
                        }
                    }

                } else if (touchButton === 1) {
                    console.log(cell);
                    // console.log(Components.ofType(Car)?.filter(c => c.coords.equals(this._selectedCellCoords)));                                        
                }
            }
                break;

            case "train": {
                if (touchButton === 0) {
                    if (cell.rail) {
                        const { layers } = state;
                        const wagonLength = 2;
                        const numWagons = 4;
                        const gap = .3;
                        const train = utils.createObject(layers.trains, "train");
                        engineState.setComponent(train, new Train({
                            cell,
                            wagonLength,
                            numWagons,
                            gap
                        }));
                    }
                }
            }
                break;

            case "belt": {
                onConveyor(mapCoords, cell, touchButton);
            }
                break;
        }
    }
}

