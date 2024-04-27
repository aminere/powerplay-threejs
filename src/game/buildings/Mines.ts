import { Vector2 } from "three";
import { utils } from "../../engine/Utils";
import { time } from "../../engine/core/Time";
import { GameUtils } from "../GameUtils";
import { IBuildingInstance, IMineState, buildingSizes } from "./BuildingTypes";
import { BuildingUtils } from "./BuildingUtils";
import { buildings } from "./Buildings";
import { MineralType } from "../GameDefinitions";

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

        console.assert(resourceCells.length > 0);
        const mineState: IMineState = {
            resourceCells,
            currentResourceCell: 0,
            active: true,
            depleted: false,
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
                    console.assert(state.outputType !== undefined);
                    if (BuildingUtils.tryFillOutputConveyors(instance, state.outputType as MineralType)) {
                        state.outputFull = false;
                        state.outputType = undefined;
                        state.active = true;
                        state.timer = 0;
                    } else {
                        state.outputCheckTimer = 1;
                    }
                } else {
                    state.outputCheckTimer -= time.deltaTime;
                }
            } else {
                state.outputType = undefined;
                state.active = true;
                state.timer = 0;
            }
            
        } else {

            if (state.timer >= miningFrequency) {
                const cell = GameUtils.getCell(state.resourceCells[state.currentResourceCell])!;
                const resource = cell.resource!;

                if (BuildingUtils.produceResource(instance, resource.type as MineralType)) {
                    resource.amount -= 1;
                    if (resource.amount === 0) {
                        cell.resource = undefined;
                        utils.fastDelete(state.resourceCells, state.currentResourceCell);
                        if (state.currentResourceCell < state.resourceCells.length - 1) {
                            state.currentResourceCell++;
                        } else {
                            console.log(`${resource.type} mine depleted at ${instance.mapCoords.x}, ${instance.mapCoords.y}`);
                            state.depleted = true;
                        }
                    }
                    state.timer = 0;

                } else {
                    state.active = false;
                    state.outputFull = true;
                    state.outputType = resource.type as MineralType;
                    state.outputCheckTimer = 1;
                }

            } else {
                state.timer += time.deltaTime;
            }
        }
    }
}

