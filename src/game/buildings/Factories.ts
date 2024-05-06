import { Vector2 } from "three";
import { IBuildingInstance, IFactoryState } from "./BuildingTypes";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { time } from "../../engine/core/Time";
import { BuildingUtils } from "./BuildingUtils";
import { FactoryDefinitions } from "./FactoryDefinitions";
import { config } from "../config/config";
import { evtBuildingStateChanged } from "../../Events";

const { inputCapacity, productionTime, inputAccepFrequency } = config.factories;

function canProduce(state: IFactoryState) {
    if (state.output) {
        const inputs = FactoryDefinitions[state.output];
        for (const input of inputs) {
            const amount = state.reserve.get(input) ?? 0;
            if (amount < 1) {
                return false;
            }
        }
        return true;
    }
    return false;
}

function removeResource(instance: IBuildingInstance) {
    const state = instance.state as IFactoryState;
    console.assert(state.output);
    const inputs = FactoryDefinitions[state.output!];
    for (const input of inputs) {
        const amount = state.reserve.get(input)!;
        console.assert(amount !== undefined);
        state.reserve.set(input, amount - 1);
    }
    evtBuildingStateChanged.post(instance);
    state.inputFull = false;
}

export class Factories {
    public static create(sectorCoords: Vector2, localCoords: Vector2, output: ResourceType | null) {

        const instance = buildings.create("factory", sectorCoords, localCoords);
        const factoryState: IFactoryState = {
            output,
            active: false,
            reserve: new Map(),
            inputTimer: -1,
            productionTimer: 0,
            inputFull: false,
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
                    if (BuildingUtils.tryFillAdjacentCells(instance, state.output!)) {
                        removeResource(instance);
                        state.outputFull = false;

                    } else {
                        state.outputCheckTimer = 1;
                    }
                } else {
                    state.outputCheckTimer -= time.deltaTime;
                }
            } else {
                if (canProduce(state)) {
                    state.active = true;
                    state.productionTimer = 0;
                    evtBuildingStateChanged.post(instance); 
                }
            }

        } else {

            if (state.productionTimer >= productionTime) {
                if (BuildingUtils.produceResource(instance, state.output!)) {
                    removeResource(instance);

                    if (canProduce(state)) {
                        state.productionTimer = 0;
                    } else {
                        state.active = false;
                        evtBuildingStateChanged.post(instance);
                    }

                } else {
                    state.active = false;
                    state.outputFull = true;
                    state.outputCheckTimer = 1;
                    evtBuildingStateChanged.post(instance);
                }
            } else {
                state.productionTimer += time.deltaTime;
                evtBuildingStateChanged.post(instance);
            }            
        }

        if (state.output) {
            if (!state.inputFull) {
                if (state.inputTimer < 0) {
                    let accepted = false;
                    let fullInputs = 0;
    
                    const inputs = FactoryDefinitions[state.output];
                    for (const input of inputs) {
                        const currentAmount = state.reserve.get(input);
                        if ((currentAmount ?? 0) < inputCapacity) {
                            if (BuildingUtils.tryGetFromAdjacentCells(instance, input)) {
                                if (currentAmount === undefined) {
                                    state.reserve.set(input, 1);
                                } else {
                                    state.reserve.set(input, currentAmount + 1);
                                }
                                accepted = true;
                            }
                        } else {
                            fullInputs++;                        
                        }
                    }
    
                    if (accepted) {                        
                        evtBuildingStateChanged.post(instance);
                    }

                    state.inputTimer = inputAccepFrequency;
                    if (fullInputs === inputs.length) {
                        state.inputFull = true;
                    }                    
                    
                } else {
                    state.inputTimer -= time.deltaTime;
                }
            }            
        }        
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
        const state = instance.state as IFactoryState;
        if (state.output) {
            const inputs = FactoryDefinitions[state.output];
            if (inputs.includes(type)) {
                const currentAmount = state.reserve.get(type);
                if ((currentAmount ?? 0) < inputCapacity) {
                    if (currentAmount === undefined) {
                        state.reserve.set(type, 1);
                    } else {
                        state.reserve.set(type, currentAmount + 1);
                    }
                    evtBuildingStateChanged.post(instance);
                    return true;
                }    
            }
        }
        return false;
    }

    public static setOutput(instance: IBuildingInstance, type: ResourceType) {
        const state = instance.state as IFactoryState;
        state.output = type;
        state.reserve.clear();
        evtBuildingStateChanged.post(instance);
    }
}


