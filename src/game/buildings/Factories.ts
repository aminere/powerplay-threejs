import { Vector2 } from "three";
import { FactoryState, IBuildingInstance, IFactoryState, buildingSizes } from "./BuildingTypes";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { makeUnitAddr, computeUnitAddr, getCellFromAddr } from "../unit/UnitAddr";
import { buildings } from "./Buildings";
import { time } from "../../engine/core/Time";
import { BuildingUtils } from "./BuildingUtils";

const cellCoords = new Vector2();

export class Factories {
    public static create(sectorCoords: Vector2, localCoords: Vector2, input: RawResourceType | ResourceType, output: ResourceType) {

        const instance = buildings.create("factory", sectorCoords, localCoords);

        const size = buildingSizes.factory;
        const outputX = size.x - 1;
        const outputY = size.z - 1;

        const { mapCoords } = instance;
        cellCoords.set(mapCoords.x + outputX, mapCoords.y + outputY);
        const outputCell = makeUnitAddr();
        computeUnitAddr(cellCoords, outputCell);

        const factoryState: IFactoryState = {
            input,
            output,
            state: FactoryState.idle,
            inputReserve: 0,
            inputAccepFrequency: 1,
            inputTimer: -1,
            outputCell,
            timer: 0
        };

        instance.state = factoryState;
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IFactoryState;
        const outputCell = getCellFromAddr(state.outputCell);

        switch (state.state) {
            case FactoryState.idle: {
                if (outputCell.pickableResource) {
                    // output full, can't process
                } else {
                    if (state.inputReserve > 0) {
                        state.inputReserve--;
                        state.state = FactoryState.processing;
                        state.timer = 0;
                    }
                }
            }
                break;

            case FactoryState.processing: {
                const productionTime = 2;
                if (state.timer >= productionTime) {

                    state.state = FactoryState.idle;
                    // onProductionDone(state.outputCell, state.output);

                } else {
                    state.timer += time.deltaTime;
                }
            }
                break;
        }

        // check nearby conveyors for input
        if (state.inputTimer < 0) {
            if (state.inputReserve < 5) {
                const size = buildingSizes.factory;
                let inputAccepted = false;
                for (let x = 0; x < size.x; ++x) {
                    if (BuildingUtils.tryGetFromAdjacentCell(state.input, instance.mapCoords, x, -1)) {
                        state.inputReserve++;
                        state.inputTimer = state.inputAccepFrequency;
                        inputAccepted = true;
                        break;
                    }
                    if (BuildingUtils.tryGetFromAdjacentCell(state.input, instance.mapCoords, x, size.z)) {
                        state.inputReserve++;
                        state.inputTimer = state.inputAccepFrequency;
                        inputAccepted = true;
                        break;
                    }
                }
                if (!inputAccepted) {
                    for (let z = 0; z < size.z; ++z) {
                        if (BuildingUtils.tryGetFromAdjacentCell(state.input, instance.mapCoords, -1, z)) {
                            state.inputReserve++;
                            state.inputTimer = state.inputAccepFrequency;
                            break;
                        }
                        if (BuildingUtils.tryGetFromAdjacentCell(state.input, instance.mapCoords, size.x, z)) {
                            state.inputReserve++;
                            state.inputTimer = state.inputAccepFrequency;
                            break;
                        }
                    }
                }
            }

        } else {
            state.inputTimer -= time.deltaTime;
        }

        if (outputCell.pickableResource) {
            BuildingUtils.tryFillAdjacentConveyors(outputCell, state.outputCell.mapCoords, outputCell.pickableResource.type);
        }
    }
}


