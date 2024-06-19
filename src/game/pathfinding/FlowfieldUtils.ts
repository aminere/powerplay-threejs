import { MathUtils, Vector2 } from "three";
import { IUnit } from "../unit/IUnit";
import { TFlowField, TFlowFieldMap, flowField } from "./Flowfield";
import { GameUtils } from "../GameUtils";
import { GameMapProps } from "../components/GameMapProps";
import { config } from "../config/config";
import { unitMotion } from "../unit/UnitMotion";

const cellCoords = new Vector2();
const cellDirection = new Vector2();
const cellDirection0 = new Vector2();
const cellDirectionx1 = new Vector2();
const cellDirectionx2 = new Vector2();
const cellDirectiony1 = new Vector2();
const cellDirectiony2 = new Vector2();
const sectorCoords = new Vector2();
const localCoords = new Vector2();

const { mapRes, cellSize } = config.game;
const mapSize = mapRes * cellSize;
const halfMapSize = mapSize / 2;

function saveFlowfield(unit: IUnit, cellIndex: number, _sectorCoords: Vector2) {
    if (unit.lastKnownFlowfield) {
        unit.lastKnownFlowfield.cellIndex = cellIndex;
        unit.lastKnownFlowfield.sectorCoords.copy(_sectorCoords);
    } else {
        unit.lastKnownFlowfield = {
            cellIndex,
            sectorCoords: _sectorCoords.clone()
        };
    }
}

function getFlowfieldDirection(unit: IUnit, _mapCoords: Vector2, _flowfield: TFlowField, dirOut: Vector2) {
    const { direction } = _flowfield;
    if (direction) {
        return dirOut.copy(direction);
    } else {
        const flowfields = flowField.getMotion(unit.motionId).flowfields;
        const computed = flowField.computeDirection(flowfields, _mapCoords, cellDirection);
        if (computed) {
            _flowfield.direction = cellDirection.clone();
            return dirOut.copy(cellDirection);

        } else {
            unitMotion.endMotion(unit);
            unit.onArrived();
            return dirOut.set(0, 0);
        }
    }
}

function getDirectionSample(
    unit: IUnit,    
    _mapCoords: Vector2,
    flowfields: TFlowFieldMap,
    dirOut: Vector2, 
    _saveFlowfield?: (unit: IUnit, cellIndex: number, _sectorCoords: Vector2) => void
) {
    if (!GameUtils.getCell(_mapCoords, sectorCoords, localCoords)) {
        return null;
    }

    const sectorId = `${sectorCoords.x},${sectorCoords.y}`;
    const sector = GameUtils.getSector(sectorCoords)!;
    const cellIndex = localCoords.y * mapRes + localCoords.x;
    const _flowField = flowfields.get(sectorId);
    if (_flowField) {
        const flowfieldInfo = _flowField[cellIndex];
        _saveFlowfield?.(unit, cellIndex, sectorCoords);
        return getFlowfieldDirection(unit, _mapCoords, flowfieldInfo, dirOut);

    } else {

        console.log(`flowfield not found for ${sectorId}`);
        if (unit.lastKnownFlowfield) {
            const lastKnownSector = unit.lastKnownFlowfield.sectorCoords;
            const _flowField = flowfields.get(`${lastKnownSector.x},${lastKnownSector.y}`)!;
            console.assert(_flowField);
            console.log(`computing based on ${lastKnownSector.x},${lastKnownSector.y}`);
            const neighborCellIndex = unit.lastKnownFlowfield.cellIndex;
            const neighborDist = _flowField[neighborCellIndex].integration;
            const cell = sector!.cells[cellIndex];
            const cellDist = neighborDist + cell.flowFieldCost;
            const newFlowfield = flowField.computeSector(cellDist, localCoords, sectorCoords);
            flowfields.set(sectorId, newFlowfield);

            _saveFlowfield?.(unit, cellIndex, sectorCoords);

            if (GameMapProps.instance.debugPathfinding) {
                sector!.flowfieldViewer.update(flowfields, sector!, sectorCoords);
                sector!.flowfieldViewer.visible = true;
            }

            const flowfieldInfo = newFlowfield[cellIndex];
            return getFlowfieldDirection(unit, _mapCoords, flowfieldInfo, dirOut);

        } else {
            console.assert(false);
            dirOut.set(0, 0);
            return dirOut;
        }
    }
}

export class FlowfieldUtils {

    public static getDirectionBilinear(unit: IUnit, directionOut: Vector2) {   
        const { coords } = unit; 
        const flowfields = flowField.getMotion(unit.motionId).flowfields;        
    
        const d = getDirectionSample(unit, unit.coords.mapCoords, flowfields, cellDirection0, saveFlowfield)!;
        const dx1 = getDirectionSample(unit, cellCoords.set(coords.mapCoords.x - 1, coords.mapCoords.y), flowfields, cellDirectionx1) ?? d;
        const dx2 = getDirectionSample(unit, cellCoords.set(coords.mapCoords.x + 1, coords.mapCoords.y), flowfields, cellDirectionx2) ?? d;
        const dy1 = getDirectionSample(unit, cellCoords.set(coords.mapCoords.x, coords.mapCoords.y - 1), flowfields, cellDirectiony1) ?? d;
        const dy2 = getDirectionSample(unit, cellCoords.set(coords.mapCoords.x, coords.mapCoords.y + 1), flowfields, cellDirectiony2) ?? d;
    
        const worldX = unit.visual.position.x;
        const worldZ = unit.visual.position.z;
        const cellWorldX = unit.coords.mapCoords.x * cellSize - halfMapSize;
        const cellWorldZ = unit.coords.mapCoords.y * cellSize - halfMapSize;
        const localX = worldX - cellWorldX;
        const localZ = worldZ - cellWorldZ;
    
        const xFactor = localX / cellSize;
        const dax = MathUtils.lerp(dx1.x, dx2.x, xFactor);
        const day = MathUtils.lerp(dx1.y, dx2.y, xFactor);
        const dbx = MathUtils.lerp(dy1.x, dy2.x, xFactor);
        const dby = MathUtils.lerp(dy1.y, dy2.y, xFactor);
    
        const xFactor2 = localZ / cellSize;
        const dx = MathUtils.lerp(dax, dbx, xFactor2);
        const dy = MathUtils.lerp(day, dby, xFactor2);
        return directionOut.set(dx, dy).normalize();
    }
    
    public static getDirection(unit: IUnit, directionOut: Vector2) {
        const { motionId, coords } = unit;    
        const flowfields = flowField.getMotion(motionId).flowfields;

        const _flowField = flowfields.get(`${coords.sectorCoords.x},${coords.sectorCoords.y}`);
        if (_flowField) {
            const currentCellIndex = coords.cellIndex;
            saveFlowfield(unit, currentCellIndex, coords.sectorCoords);

            const flowfieldInfo = _flowField[currentCellIndex];
            return getFlowfieldDirection(unit, coords.mapCoords, flowfieldInfo, directionOut);
    
        } else {
    
            console.log(`flowfield not found for ${coords.sectorCoords.x},${coords.sectorCoords.y}`);
            if (unit.lastKnownFlowfield) {
                const lastKnownSector = unit.lastKnownFlowfield.sectorCoords;
                const _flowField = flowfields.get(`${lastKnownSector.x},${lastKnownSector.y}`)!;
                console.assert(_flowField);
                console.log(`computing based on ${lastKnownSector.x},${lastKnownSector.y}`);
                const neighborCellIndex = unit.lastKnownFlowfield.cellIndex;
                const neighborDist = _flowField[neighborCellIndex].integration;
                const cell = coords.sector!.cells[coords.cellIndex];
                const cellDist = neighborDist + cell.flowFieldCost;
                const newFlowfield = flowField.computeSector(cellDist, coords.localCoords, coords.sectorCoords);
                flowfields.set(`${coords.sectorCoords.x},${coords.sectorCoords.y}`, newFlowfield);
                unit.lastKnownFlowfield.cellIndex = coords.cellIndex;
                unit.lastKnownFlowfield.sectorCoords.copy(coords.sectorCoords);
    
                if (GameMapProps.instance.debugPathfinding) {
                    coords.sector!.flowfieldViewer.update(flowfields, coords.sector!, coords.sectorCoords);
                    coords.sector!.flowfieldViewer.visible = true;
                }
    
                const flowfieldInfo = newFlowfield[coords.cellIndex];
                return getFlowfieldDirection(unit, coords.mapCoords, flowfieldInfo, directionOut);
    
            } else {
                console.assert(false);
                directionOut.set(0, 0);
                return directionOut;
            }
        }
    }
}

