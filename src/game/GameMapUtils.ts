import { Box2, BufferAttribute, BufferGeometry, Camera, Line3, Mesh, OrthographicCamera, Plane, Triangle, Vector2, Vector3 } from "three";
import { GameUtils } from "./GameUtils";
import { config } from "./config";
import { engine } from "../engine/Engine";
import { elevation } from "./Elevation";
import { MineralType, MineralTypes, RawResourceType, TileType, TileTypes } from "./GameDefinitions";
import { ICell } from "./GameTypes";
import { roads } from "./Roads";
import { Rails } from "./Rails";
import { resources } from "./Resources";
import { Sector } from "./Sector";
import { buildings } from "./buildings/Buildings";
import { conveyors } from "./Conveyors";
import { engineState } from "../engine/EngineState";
import { utils } from "../engine/Utils";
import { Train } from "./components/Train";
import { GameMapProps } from "./components/GameMapProps";
import { GameMapState } from "./components/GameMapState";
import { unitsManager } from "./unit/UnitsManager";
import { buildingSizes } from "./buildings/BuildingTypes";
import { Factories } from "./buildings/Factories";
import { Mines } from "./buildings/Mines";
import { Depots } from "./buildings/Depots";
import { Incubators } from "./buildings/Incubators";

const cellCoords = new Vector2();
const sectorCoords = new Vector2();
const localCoords = new Vector2();
const plane = new Plane();
const triangle = new Triangle();
const line = new Line3();
const rayEnd = new Vector3();
const v1 = new Vector3();
const v2 = new Vector3();
const v3 = new Vector3();
const intersection = new Vector3();
const normalizedPos = new Vector2();
const neighborCoord = new Vector2();
const min = new Vector2();
const max = new Vector2();
const worldPos = new Vector3();

const { elevationStep, cellSize, mapRes, cellsPerRoadBlock } = config.game;
const { scale: trainScale } = config.trains;
const mapSize = mapRes * cellSize;
const halfMapSize = mapSize / 2;

function pickSectorTriangle(sectorX: number, sectorY: number, screenPos: Vector2, camera: Camera) {
    const { sectors } = GameMapState.instance;
    const sector = sectors.get(`${sectorX},${sectorY}`);
    if (!sector) {
        return -1;
    }
    let selectedVertexIndex = -1;
    const { width, height } = engine.screenRect;
    normalizedPos.set((screenPos.x / width) * 2 - 1, -(screenPos.y / height) * 2 + 1);
    GameUtils.rayCaster.setFromCamera(normalizedPos, camera);
    const { ray } = GameUtils.rayCaster;
    rayEnd.copy(ray.origin).addScaledVector(ray.direction, (camera as OrthographicCamera).far);
    line.set(ray.origin, rayEnd);
    const geometry = (sector.layers.terrain as Mesh).geometry as BufferGeometry;
    const position = geometry.getAttribute("position") as BufferAttribute;
    const indices = geometry.getIndex()!.array;
    const sectorOffsetX = sectorX * mapSize - halfMapSize;
    const sectorOffsetY = sectorY * mapSize - halfMapSize;
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

export function raycastOnCells(screenPos: Vector2, camera: Camera, cellCoordsOut: Vector2, resolution: number, sectorCoordsOut?: Vector2) {
    if (!GameUtils.screenCastOnPlane(camera, screenPos, 0, intersection)) {
        return null;
    }
    GameUtils.worldToMap(intersection, cellCoordsOut);

    const _sectorCoords = sectorCoordsOut ?? sectorCoords;
    let cell = GameUtils.getCell(cellCoordsOut, _sectorCoords);
    let sectorX = _sectorCoords.x;
    let sectorY = _sectorCoords.y;
    let selectedVertexIndex = cell ? pickSectorTriangle(sectorX, sectorY, screenPos, camera) : -1;

    if (selectedVertexIndex < 0 && cell) {
        // check neighboring sectors, from closest to farthest
        const neighborSectors = new Array<[number, number]>();
        const { sectors } = GameMapState.instance;
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
        _sectorCoords.set(sectorX, sectorY);
        cell = GameMapState.instance.sectors.get(`${sectorX},${sectorY}`)!.cells[selectedCell];
    }

    cellCoordsOut.set(Math.floor(cellCoordsOut.x / resolution) * resolution, Math.floor(cellCoordsOut.y / resolution) * resolution);
    return cell;
}

export function onDrag(start: Vector2, current: Vector2) { // map coords

    const state = GameMapState.instance;
    const { resolution } = state.tileSelector;
    switch (state.action) {
        case "road": {
            state.previousRoad.forEach(road => roads.clear(road));
            state.previousRoad.length = 0;
            roads.onDrag(start, current, state.previousRoad, state.initialDragAxis!, resolution);
        }
            break;

        case "rail": {
            state.previousRail.forEach(Rails.clear);
            state.previousRail.length = 0;
            Rails.onDrag(start, current, state.initialDragAxis!, state.previousRail);
        }
            break;

        case "belt": {
            state.previousConveyors.forEach(cell => conveyors.clear(cell));
            state.previousConveyors.length = 0;
            conveyors.onDrag(start, current, state.initialDragAxis!, state.previousConveyors);
        }
            break;

        case "elevation": {
            onElevation(current, 0);
            state.tileSelector.fit(current.x, current.y, state.sectors);
        }
            break;

        case "water": {
            onWater(current, 0);
            state.tileSelector.fit(current.x, current.y, state.sectors);
        }
            break;
    }
}

export function onBeginDrag(start: Vector2, current: Vector2) { // map coords
    const state = GameMapState.instance;
    if (start.x === current.x) {
        state.initialDragAxis = "z";
    } else if (start.y === current.y) {
        state.initialDragAxis = "x";
    } else {
        if (current.y < start.y) {
            state.initialDragAxis = "x";
        } else {
            state.initialDragAxis = "z";
        }
    }

    switch (state.action) {
        case "rail": {
            for (const offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                neighborCoord.set(start.x + offset[0], start.y + offset[1]);
                const neighbor = GameUtils.getCell(neighborCoord);
                const rail = neighbor?.rail
                if (rail) {
                    state.initialDragAxis = rail.axis;
                    break;
                }
            }
        }
            break;

        case "elevation": {
            onElevation(start, 0);
            state.tileSelector.fit(start.x, start.y, state.sectors);
        }
            break;

        case "water": {
            onWater(start, 0);
            state.tileSelector.fit(start.x, start.y, state.sectors);
        }
            break;
    }

    onDrag(start, current);
}

export function onEndDrag() {
    const gameMapState = GameMapState.instance;
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
    const gameMapState = GameMapState.instance;
    gameMapState.previousRoad.forEach(road => roads.clear(road));
    gameMapState.previousRoad.length = 0;
    gameMapState.previousRail.forEach(Rails.clear);
    gameMapState.previousRail.length = 0;
    gameMapState.previousConveyors.forEach(cell => conveyors.clear(cell));
    gameMapState.previousConveyors.length = 0;
}

function onElevation(mapCoords: Vector2, button: number) {
    const { brushSize, brushHeight, relativeBrush } = GameMapProps.instance;
    if (button === 0) {
        elevation.elevate(mapCoords, brushSize, brushHeight, relativeBrush);
    } else if (button === 2) {
        elevation.elevate(mapCoords, brushSize, -brushHeight, relativeBrush);
    }
}

function onWater(mapCoords: Vector2, button: number) {
    const { brushSize } = GameMapProps.instance;
    if (button === 0) {
        elevation.createWaterPatch(mapCoords, brushSize);
    } else if (button === 2) {
        elevation.clearWaterPatch(mapCoords, brushSize);
    }    
}

function onRoad(mapCoords: Vector2, cell: ICell, button: number) {
    if (button === 0) {        
        const empty = (() => {
            for (let i = 0; i < cellsPerRoadBlock; ++i) {
                for (let j = 0; j < cellsPerRoadBlock; ++j) {
                    cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                    const roadPatchCell = GameUtils.getCell(cellCoords)!;
                    if (!roadPatchCell.isEmpty) {
                        return false;
                    }
                }
            }
            return true;
        })();

        if (empty) {
            roads.create(mapCoords);
        }

    } else if (button === 2) {
        if (cell.roadTile !== undefined) {
            roads.clear(mapCoords);
        }
    }
}

function onBuilding(sectorCoords: Vector2, localCoords: Vector2, cell: ICell, button: number) {
    const props = GameMapProps.instance;
    const { buildingType } = props;

    if (button === 0) {
        const size = buildingSizes[buildingType];

        // TODO if units under the structure, move them away
        const allowed = (() => {

            const validateCell = (cell: ICell | null) => (cell !== null && cell.isEmpty && !cell.hasUnits && !cell.pickableResource);

            const validateCells = (isValid: (cell: ICell | null) => boolean) => {
                for (let i = 0; i < size.z; ++i) {
                    for (let j = 0; j < size.x; ++j) {
                        cellCoords.set(sectorCoords.x * mapRes + localCoords.x + j, sectorCoords.y * mapRes + localCoords.y + i);
                        const _cell = GameUtils.getCell(cellCoords);
                        if (!isValid(_cell)) {
                            return false;
                        }
                    }
                }
                return true;
            };

            switch (buildingType) {
                case "mine": {

                    let resourceCount = 0;
                    const cellsValid = validateCells(cell => {
                        if (!cell || cell.hasUnits) {
                            return false;
                        }
                        
                        const hasMineral = MineralTypes.includes(cell.resource?.type as MineralType);
                        if (hasMineral && !cell.building) {
                            resourceCount++;
                            return true;
                        } else {
                            return cell.isEmpty;
                        }
                    });

                    return cellsValid && resourceCount > 0;
                }

                default: {
                    return validateCells(validateCell);
                }
            }

        })();
        if (allowed) {
            switch (buildingType) {
                case "factory": Factories.create(sectorCoords, localCoords, props.factoryInput, props.factoryOutput); break;
                case "mine": Mines.create(sectorCoords, localCoords); break;
                case "depot": Depots.create(sectorCoords, localCoords, props.depotType); break;
                case "incubator": Incubators.create(sectorCoords, localCoords); break;
                default: buildings.create(buildingType, sectorCoords, localCoords);
            }
        }

    } else if (button === 2) {
        if (cell.building) {
            buildings.clear(cell.building);
        }
    }
}

function onResource(sectorCoords: Vector2, localCoords: Vector2, cell: ICell, button: number, type: RawResourceType) {
    const { sectors } = GameMapState.instance;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    if (button === 0) {
        const units = cell.units?.length ?? 0;
        if (cell.isEmpty && units === 0) {
            resources.create(sector, sectorCoords, localCoords, cell, type);
        }
    } else if (button === 2) {
        if (cell.resource) {
            cell.resource = undefined;
        }
    }
}

function onTerrain(mapCoords: Vector2, tileType: TileType) {
    GameUtils.getCell(mapCoords, sectorCoords, localCoords)!;
    const terrainTileIndex = TileTypes.indexOf(tileType);
    console.assert(terrainTileIndex >= 0);
    const baseTerrainTileIndex = 32;
    const tileIndex = baseTerrainTileIndex + terrainTileIndex;
    const { sectors } = GameMapState.instance;
    const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    Sector.updateCellTexture(sector, localCoords, tileIndex);
}

function onConveyor(mapCoords: Vector2, cell: ICell, button: number) {
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
    const state = GameMapState.instance;

    const sector = Sector.create(coords);
    state.sectorsRoot.add(sector.root);

    // update bounds
    const { mapRes, cellSize } = config.game;
    const mapSize = mapRes * cellSize;
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

function disposeSectors() {
    const state = GameMapState.instance;
    const { sectors } = state;
    for (const sector of sectors.values()) {
        const { root } = sector;
        root.removeFromParent();
        root.traverse((obj) => {
            utils.disposeObject(obj);
        });
    }
    sectors.clear();
}

export function createSectors(size: number) {
    const state = GameMapState.instance;
    if (state.sectors.size > 0) {
        disposeSectors();
    }

    for (let i = 0; i < size; ++i) {
        for (let j = 0; j < size; ++j) {
            createSector(new Vector2(j, i));
        }
    }
}

function updateCameraBounds() {
    const state = GameMapState.instance;
    const [top, right, bottom, left] = state.cameraBounds;
    const mapBounds = state.bounds;
    GameUtils.worldToScreen(worldPos.set(mapBounds!.min.x, 0, mapBounds!.min.y), state.camera, top);
    GameUtils.worldToScreen(worldPos.set(mapBounds!.max.x, 0, mapBounds!.max.y), state.camera, bottom);
    GameUtils.worldToScreen(worldPos.set(mapBounds!.min.x, 0, mapBounds!.max.y), state.camera, left);
    GameUtils.worldToScreen(worldPos.set(mapBounds!.max.x, 0, mapBounds!.min.y), state.camera, right);
    utils.updateDirectionalLightTarget(state.light);
}

export function setCameraPos(pos: Vector3) {
    const state = GameMapState.instance;
    state.cameraRoot.position.copy(pos);
    updateCameraBounds();
}

export function onAction(touchButton: number) {
    const state = GameMapState.instance;
    const props = GameMapProps.instance;

    const cell = GameUtils.getCell(state.selectedCellCoords, sectorCoords, localCoords);
    if (!cell) {
        createSector(sectorCoords.clone());
        updateCameraBounds();
    } else {
        const mapCoords = state.selectedCellCoords;
        switch (state.action) {
            case "elevation": {
                onElevation(mapCoords, touchButton);
                state.tileSelector.fit(mapCoords.x, mapCoords.y, state.sectors);
            }
                break;

            case "flatten": {
                const { brushSize } = GameMapProps.instance;
                elevation.elevate(mapCoords, brushSize, 0, false);
                state.tileSelector.fit(mapCoords.x, mapCoords.y, state.sectors);
            }
            break;

            case "water": {
                onWater(mapCoords, touchButton);
                state.tileSelector.fit(mapCoords.x, mapCoords.y, state.sectors);
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
                onBuilding(sectorCoords, localCoords, cell, touchButton);
            }
                break;

            case "resource": {
                onResource(sectorCoords, localCoords, cell, touchButton, props.resourceType);
            }
                break;

            case "train": {
                if (touchButton === 0) {
                    if (cell.rail) {
                        const { layers } = state;
                        const wagonLength = cellSize * 2 * trainScale;
                        const numWagons = 4;
                        const gap = .3;
                        const train = utils.createObject(layers.trains, "train");
                        engineState.setComponent(train, new Train({
                            cell: mapCoords,
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

            case "unit": {
                if (touchButton === 0) {
                    if (cell.isEmpty) {
                        unitsManager.spawn(mapCoords, props.unit);
                    }
                } else if (touchButton === 2) {
                    if (cell.units) {
                        const cellUnits = [...cell.units];
                        for (const unit of cellUnits) {
                            unit.setHealth(0);
                        }
                    }
                }
            }
            break;

            case "rail": {
                if (touchButton === 2) {
                    if (cell.rail) {
                        Rails.clear(cell);
                    }
                }
            }
            break;

        }
    }
}

export function updateCameraSize() {
    const state = GameMapState.instance;
    const { width, height } = engine.screenRect;
    const aspect = width / height;
    const { orthoSize, shadowRange } = config.camera;

    const orthoCamera = (state.camera as OrthographicCamera);
    orthoCamera.zoom = 1 / state.cameraZoom;
    // const zoom = this.state.cameraZoom;
    // orthoCamera.left = -orthoSize * aspect * zoom;
    // orthoCamera.right = orthoSize * aspect * zoom;
    // orthoCamera.top = orthoSize * zoom;
    // orthoCamera.bottom = -orthoSize * zoom;
    orthoCamera.updateProjectionMatrix();

    updateCameraBounds();
    const cameraLeft = -orthoSize * state.cameraZoom * aspect;
    const cameraArea = Math.abs(cameraLeft);
    const _shadowRange = Math.max(cameraArea * shadowRange, 10);
    state.light.shadow.camera.left = -_shadowRange;
    state.light.shadow.camera.right = _shadowRange;
    state.light.shadow.camera.top = _shadowRange;
    state.light.shadow.camera.bottom = -_shadowRange;
    state.light.shadow.camera.updateProjectionMatrix();
}

