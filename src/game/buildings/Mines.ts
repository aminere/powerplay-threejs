import { Vector2 } from "three";
import { utils } from "../../engine/Utils";
import { time } from "../../engine/core/Time";
import { GameUtils } from "../GameUtils";
import { IBuildingInstance, IMineState, buildingSizes } from "./BuildingTypes";
import { BuildingUtils } from "./BuildingUtils";
import { buildings } from "./Buildings";
import { MineralType } from "../GameDefinitions";
import { ICell } from "../GameTypes";

const cellCoords = new Vector2();
const miningFrequency = 2;

export class Mines {
    public static create(sectorCoords: Vector2, localCoords: Vector2) {
        const instance = buildings.create("mine", sectorCoords, localCoords);
        
        const { mapCoords } = instance;
        const size = buildingSizes["mine"];
        const resourceCells = new Array<Vector2>();
        for (let i = 0; i < size.z; i++) {
            for (let j = 0; j < size.x; j++) {
                cellCoords.set(mapCoords.x + j, mapCoords.y + i);
                const cell = GameUtils.getCell(cellCoords)!;
                if (cell.resource) {
                    resourceCells.push(cellCoords.clone());
                    cell.resource.visual!.visible = false;
                }
            }
        }

        const depleted = resourceCells.length === 0;
        const mineState: IMineState = {
            resourceCells,
            currentResourceCell: 0,
            active: !depleted,
            depleted,
            timer: 0,
            outputConveyorIndex: -1,
            outputFull: false,
            outputCheckTimer: -1
        };

        instance.state = mineState;
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IMineState;
        if (state.depleted) {
            return;
        }

        if (!state.active) {

            if (state.outputFull) {
                if (state.outputCheckTimer < 0) {
                    console.assert(state.minedCell !== undefined);
                    const resourceType = state.minedCell!.resource!.type;
                    if (BuildingUtils.tryFillAdjacentCells(instance, resourceType as MineralType)) {
                        Mines.consumeResource(state, state.minedCell!);
                        state.outputFull = false;
                    } else {
                        state.outputCheckTimer = 1;
                    }
                } else {
                    state.outputCheckTimer -= time.deltaTime;
                }
            } else {
                state.minedCell = undefined;
                state.active = true;
                state.timer = 0;
            }
            
        } else {

            if (state.timer >= miningFrequency) {
                const minedCell = GameUtils.getCell(state.resourceCells[state.currentResourceCell])!;
                if (BuildingUtils.produceResource(instance, minedCell.resource!.type as MineralType)) {
                    Mines.consumeResource(state, minedCell);
                    state.timer = 0;

                } else {
                    state.active = false;
                    state.outputFull = true;
                    state.minedCell = minedCell;
                    state.outputCheckTimer = 1;
                }

            } else {
                state.timer += time.deltaTime;
            }
        }
    }

    public static consumeResource(state: IMineState, cell: ICell) {
        const resource = cell.resource!;
        resource.amount -= 1;
        if (resource.amount === 0) {
            cell.resource = undefined;
            utils.fastDelete(state.resourceCells, state.currentResourceCell);
            if (state.currentResourceCell < state.resourceCells.length - 1) {
                state.currentResourceCell++;
            } else {
                state.depleted = true;
            }
        }
    }
}

