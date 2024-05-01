import { Vector2 } from "three";
import { IBuildingInstance, IFactoryState } from "./BuildingTypes";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { time } from "../../engine/core/Time";
import { BuildingUtils } from "./BuildingUtils";

const productionTime = 2;
const inputAccepFrequency = 1;

export class Factories {
    public static create(sectorCoords: Vector2, localCoords: Vector2, input: RawResourceType | ResourceType, output: ResourceType) {

        const instance = buildings.create("factory", sectorCoords, localCoords);
        const factoryState: IFactoryState = {
            input,
            output,
            active: false,
            inputReserve: 0,
            inputCapacity: 5,
            inputTimer: -1,
            timer: 0,
            outputFull: false,
            outputCheckTimer: -1
        };

        instance.state = factoryState;
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IFactoryState;
        if (!state.active) {

            if (state.outputFull) {
                if (state.outputCheckTimer < 0) {
                    if (BuildingUtils.tryFillAdjacentCells(instance, state.output)) {
                        Factories.consumeResource(state);
                        state.outputFull = false;

                    } else {
                        state.outputCheckTimer = 1;
                    }
                } else {
                    state.outputCheckTimer -= time.deltaTime;
                }
            } else {
                if (state.inputReserve > 0) {
                    state.active = true;
                    state.timer = 0;    
                }
            }

        } else {

            if (state.timer >= productionTime) {
                if (BuildingUtils.produceResource(instance, state.output)) {
                    Factories.consumeResource(state);

                    if (state.inputReserve > 0) {
                        state.timer = 0;
                    } else {
                        state.active = false;
                    }

                } else {
                    state.active = false;
                    state.outputFull = true;
                    state.outputCheckTimer = 1;
                }
            } else {
                state.timer += time.deltaTime;
            }
        }

        if (state.inputTimer < 0) {
            if (state.inputReserve < state.inputCapacity) {
                if (BuildingUtils.tryGetFromAdjacentCells(instance, state.input)) {
                    state.inputReserve++;
                    state.inputTimer = inputAccepFrequency;
                }
            }

        } else {
            state.inputTimer -= time.deltaTime;
        }
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
        const state = instance.state as IFactoryState;
        if (state.input === type) {
            if (state.inputReserve < state.inputCapacity) {
                state.inputReserve++;
                return true;
            }
        }
        return false;
    }

    public static onResourcePicked(instance: IBuildingInstance) {
        const state = instance.state as IFactoryState;
        Factories.consumeResource(state);
        state.outputFull = false;
    }

    public static consumeResource(state: IFactoryState) {
        state.inputReserve--;
    }
}


