import { Vector2 } from "three";
import { IAssemblyState, IBuildingInstance } from "./BuildingTypes";
import { ResourceType, VehicleType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { time } from "../../engine/core/Time";
import { BuildingUtils } from "./BuildingUtils";
import { config } from "../config/config";
import { cmdSpawnUnit, evtBuildingStateChanged } from "../../Events";
import { resourceConfig } from "../config/ResourceConfig";

const { inputCapacity, productionTime, inputAccepFrequency } = config.assemblies;

function canOutput(state: IAssemblyState) {
    if (state.output) {
        const inputs = resourceConfig.assemblyProduction[state.output];
        for (const [type, amount] of inputs) {            
            const reserve = state.reserve.get(type) ?? 0;
            if (reserve < amount) {
                return false;
            }
        }
        return true;
    }
    return false;
}

function canAcceptResource(instance: IBuildingInstance, type: ResourceType) {
    const state = instance.state as IAssemblyState;
    if (state.output) {
        const inputs = resourceConfig.assemblyProduction[state.output];
        for (const [input] of inputs) {
            if (input === type) {
                const currentAmount = state.reserve.get(type) ?? 0;
                if (currentAmount < inputCapacity) {
                    return true;
                }
            }
        }
    }
    return false;
}

export class Assemblies {
    public static create(sectorCoords: Vector2, localCoords: Vector2, output: VehicleType | null) {

        const instance = buildings.create("assembly", sectorCoords, localCoords);
        const state: IAssemblyState = {
            active: false,
            productionTimer: 0,
            reserve: new Map([
                ["steel", 1],
                ["engine", 1],
                ["tire", 4]
            ]),
            inputFull: false,            
            inputTimer: -1,
            outputRequests: 0,            
            output            
        };

        instance.state = state;
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IAssemblyState;
        if (state.active) {

            let isDone = false;
            state.productionTimer += time.deltaTime;
            if (state.productionTimer > productionTime) {
                state.productionTimer = productionTime;
                isDone = true;
            }

            if (isDone) {
                cmdSpawnUnit.post([instance, state.output!]);

                state.outputRequests--;
                if (state.outputRequests > 0) {
                    state.productionTimer = 0;
                } else {
                    state.active = false;                    
                }
            }

            evtBuildingStateChanged.post(instance);
            
        } else {

            if (state.outputRequests > 0) {                
                state.productionTimer = 0;
                state.active = true;
                evtBuildingStateChanged.post(instance);
            }
        }

        if (state.output) {
            if (!state.inputFull) {
                if (state.inputTimer < 0) {
                    let accepted = false;
                    let fullInputs = 0;

                    const inputs = resourceConfig.assemblyProduction[state.output];
                    for (const [input] of inputs) {
                        const currentAmount = state.reserve.get(input) ?? 0;
                        if (currentAmount < inputCapacity) {
                            if (BuildingUtils.tryGetFromAdjacentCells(instance, input)) {
                                state.reserve.set(input, currentAmount + 1);
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

    public static output(instance: IBuildingInstance) {        
        const state = instance.state as IAssemblyState;
        if (!canOutput(state)) {
            return false;
        }
        state.outputRequests++;    
        const inputs = resourceConfig.assemblyProduction[state.output!];
        for (const [type, amount] of inputs) {
            const reserve = state.reserve.get(type)!;
            state.reserve.set(type, reserve - amount);
        }
        state.inputFull = false;
        evtBuildingStateChanged.post(instance);
        return true;
    }    

    public static tryDepositResource(instance: IBuildingInstance, type: ResourceType) {
        if (canAcceptResource(instance, type)) {
            const state = instance.state as IAssemblyState;
            const currentAmount = state.reserve.get(type) ?? 0;
            state.reserve.set(type, currentAmount + 1);
            evtBuildingStateChanged.post(instance);
            return true;
        }
        return false;
    }

    public static setOutput(instance: IBuildingInstance, type: VehicleType) {
        const state = instance.state as IAssemblyState;
        state.output = type;
        // state.reserve.clear();
        state.active = false;
        state.outputRequests = 0;
        state.inputFull = false;
        evtBuildingStateChanged.post(instance);
    }
}


