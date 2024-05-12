import { Vector2 } from "three";
import { IBuildingInstance, IFactoryState } from "./BuildingTypes";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { time } from "../../engine/core/Time";
import { BuildingUtils } from "./BuildingUtils";
import { config } from "../config/config";
import { evtBuildingStateChanged } from "../../Events";
import { resourceConfig } from "../config/ResourceConfig";

const { inputCapacity, productionTime, inputAccepFrequency } = config.factories;

function canOutput(state: IFactoryState) {
    if (state.output) {
        const inputs = resourceConfig.factoryProduction[state.output];
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

function canAcceptResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
    const state = instance.state as IFactoryState;
    if (state.output) {
        const inputs = resourceConfig.factoryProduction[state.output];
        for (const input of inputs) {
            if (input === type) {
                const currentAmount = state.reserve.get(type);
                if ((currentAmount ?? 0) < inputCapacity) {
                    return true;
                }
            }
        }
    }
    return false;
}

export class Factories {
    public static create(sectorCoords: Vector2, localCoords: Vector2, output: ResourceType | null) {

        const instance = buildings.create("factory", sectorCoords, localCoords);
        const factoryState: IFactoryState = {
            active: false,
            productionTimer: 0,
            reserve: new Map(),
            inputFull: false,            
            inputTimer: -1,
            outputRequests: 0,            
            output,
            outputFull: false,
            outputCheckTimer: -1,
            autoOutput: true
        };

        instance.state = factoryState;
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IFactoryState;
        if (state.active) {

            let isDone = false;
            state.productionTimer += time.deltaTime;
            if (state.productionTimer > productionTime) {
                state.productionTimer = productionTime;
                isDone = true;
            }

            if (isDone) {
                if (BuildingUtils.produceResource(instance, state.output!)) {
                    state.outputRequests--;
                    if (state.outputRequests > 0) {
                        state.productionTimer = 0;
                    } else {

                        if (state.autoOutput) {
                            const status = Factories.output(instance);
                            switch (status) {
                                case "ok": state.productionTimer = 0; break;
                                default: state.active = false;
                            }
                            
                        } else {
                            state.active = false;
                        }
                    }

                } else {
                    state.active = false;
                    state.outputFull = true;
                    state.outputCheckTimer = 1;
                }
            }

            evtBuildingStateChanged.post(instance);
            
        } else {

            if (state.outputFull) {
                if (state.outputCheckTimer < 0) {
                    if (BuildingUtils.tryFillAdjacentCells(instance, state.output!)) {
                        state.outputRequests--;
                        state.outputFull = false;
                        evtBuildingStateChanged.post(instance);
                    } else {
                        state.outputCheckTimer = 1;
                    }
                } else {
                    state.outputCheckTimer -= time.deltaTime;
                }
            } else {
                if (state.outputRequests > 0) {
                    state.productionTimer = 0;                    
                    state.active = true;
                    evtBuildingStateChanged.post(instance);
                } else if (state.autoOutput) {
                    Factories.output(instance);
                }
            }
        }

        if (state.output) {
            if (!state.inputFull) {
                if (state.inputTimer < 0) {
                    let accepted = false;
                    let fullInputs = 0;

                    const inputs = resourceConfig.factoryProduction[state.output];
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

    public static output(instance: IBuildingInstance) {
        const state = instance.state as IFactoryState;
        if (state.outputFull) {
            return "output-full";
        }

        if (!canOutput(state)) {
            return "not-enough";
        }

        state.outputRequests++;        
        const inputs = resourceConfig.factoryProduction[state.output!];
        for (const input of inputs) {
            const amount = state.reserve.get(input)!;
            state.reserve.set(input, amount - 1);
        }
        state.inputFull = false;
        evtBuildingStateChanged.post(instance);
        return "ok";
    }

    public static toggleAutoOutput(instance: IBuildingInstance) {
        const state = instance.state as IFactoryState;
        state.autoOutput = !state.autoOutput;
        evtBuildingStateChanged.post(instance);
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
        if (canAcceptResource(instance, type)) {
            const state = instance.state as IFactoryState;
            const currentAmount = state.reserve.get(type);
            if (currentAmount === undefined) {
                state.reserve.set(type, 1);
            } else {
                state.reserve.set(type, currentAmount + 1);
            }
            evtBuildingStateChanged.post(instance);
            return true;
        }
        return false;
    }

    public static setOutput(instance: IBuildingInstance, type: ResourceType) {
        const state = instance.state as IFactoryState;
        state.output = type;
        state.reserve.clear();
        state.active = false;
        state.outputRequests = 0;
        state.outputFull = false;
        state.inputFull = false;
        evtBuildingStateChanged.post(instance);
    }
}


