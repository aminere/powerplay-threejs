import { Vector2 } from "three";
import { utils } from "../../engine/Utils";
import { time } from "../../engine/core/Time";
import { GameUtils } from "../GameUtils";
import { IBuildingInstance, IMineState, buildingSizes } from "./BuildingTypes";
import { BuildingUtils } from "./BuildingUtils";
import { buildings } from "./Buildings";
import { MineralType } from "../GameDefinitions";

const cellCoords = new Vector2();

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
            outputFull: false
        };

        instance.state = mineState;
    }

    public static update(instance: IBuildingInstance) {
        const miningFrequency = 2;
        const state = instance.state as IMineState;
        if (state.depleted) {
            return;
        }

        if (!state.active) {
            
            if (!state.outputFull) {
                // start mining a new resource
                state.active = true;
                state.timer = 0;
            } else {

                // TODO periodically (1s) check if there is space in the output
            }

        } else {

            if (state.timer >= miningFrequency) {
                const cell = GameUtils.getCell(state.resourceCells[state.currentResourceCell])!;
                const resource = cell.resource!;

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

                state.active = false;
                if (!BuildingUtils.produceResource(instance, resource.type as MineralType)) {
                    state.outputFull = true;
                    console.log("mine output full");
                }

            } else {
                state.timer += time.deltaTime;
            }
        }
    }
}

