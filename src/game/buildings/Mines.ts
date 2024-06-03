import { Vector2 } from "three";
import { utils } from "../../engine/Utils";
import { time } from "../../engine/core/Time";
import { GameUtils } from "../GameUtils";
import { IBuildingInstance, IMineState } from "./BuildingTypes";
import { BuildingUtils } from "./BuildingUtils";
import { buildings } from "./Buildings";
import { MineralType } from "../GameDefinitions";
import { buildingConfig } from "../config/BuildingConfig";
import { evtBuildingStateChanged } from "../../Events";
import { config } from "../config/config";
import { Particles } from "../../engine/components/Particles";

const cellCoords = new Vector2();
const { productionTime } = config.mines;

function consumeResource(instance: IBuildingInstance) {
    const state = instance.state as IMineState;
    const minedCell = GameUtils.getCell(state.resourceCells[0])!;
    const resource = minedCell.resource!;
    resource!.amount -= 1;
    if (resource.amount === 0) {
        minedCell.resource = undefined;
        utils.fastDelete(state.resourceCells, 0);
        if (state.resourceCells.length === 0) {
            state.depleted = true;
        }
    }
}

function setMineActive(state: IMineState, active: boolean) {
    state.active = active;
    const particles = utils.getComponent(Particles, state.smoke)!;
    particles.state.isEmitting = active;
}

export class Mines {
    public static create(sectorCoords: Vector2, localCoords: Vector2) {
        const instance = buildings.create("mine", sectorCoords, localCoords);
        
        const { mapCoords } = instance;
        const size = buildingConfig["mine"].size;
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
            active: false,
            productionTimer: 0,
            outputRequests: 0,
            outputFull: false,
            outputCheckTimer: -1,
            autoOutput: true,
            resourceCells,
            minedResource: null,
            depleted,
            smoke: instance.visual.getObjectByName("smoke")!
        };

        setMineActive(mineState, false);
        instance.state = mineState;
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IMineState;        
        if (state.active) {

            let isDone = false;
            state.productionTimer += time.deltaTime;
            if (state.productionTimer > productionTime) {
                state.productionTimer = productionTime;
                isDone = true;
            }

            if (isDone) {
                console.assert(state.minedResource);
                if (BuildingUtils.produceResource(instance, state.minedResource!)) {
                    state.outputRequests--;
                    consumeResource(instance);
                    if (state.outputRequests > 0) {
                        const minedCell = GameUtils.getCell(state.resourceCells[0])!;
                        state.minedResource = minedCell.resource!.type as MineralType;                      
                        state.productionTimer = 0;
                    } else {
                        if (state.autoOutput) {
                            const status = Mines.output(instance);
                            switch (status) {
                                case "ok": state.productionTimer = 0; break;
                                default: {
                                    setMineActive(state, false);
                                    state.minedResource = null;
                                }
                            }
                            
                        } else {
                            setMineActive(state, false);
                            state.minedResource = null;
                        }
                    }

                } else {
                    setMineActive(state, false);
                    state.outputFull = true;
                    state.outputCheckTimer = 1;
                }
            }

            evtBuildingStateChanged.post(instance);

        } else {

            if (state.outputFull) {
                if (state.outputCheckTimer < 0) {
                    console.assert(state.minedResource);                    
                    if (BuildingUtils.produceResource(instance, state.minedResource!)) {
                        state.outputRequests--;
                        consumeResource(instance);
                        state.outputFull = false;
                        state.minedResource = null;
                        evtBuildingStateChanged.post(instance);
                    } else {
                        state.outputCheckTimer = 1;
                    }
                } else {
                    state.outputCheckTimer -= time.deltaTime;
                }
            } else {

                if (state.outputRequests > 0) {   
                    const minedCell = GameUtils.getCell(state.resourceCells[0])!;
                    state.minedResource = minedCell.resource!.type as MineralType;
                    state.productionTimer = 0;
                    setMineActive(state, true);
                    evtBuildingStateChanged.post(instance);                                       

                } else if (state.autoOutput) {
                    Mines.output(instance);
                }
            }
        }
    }

    public static output(instance: IBuildingInstance) {
        const state = instance.state as IMineState;
        if (state.depleted) {
            return "depleted";
        }

        if (state.outputFull) {
            return "output-full";
        }

        const totalResources = state.resourceCells.reduce((prev, cur) => {
            const cell = GameUtils.getCell(cur)!;
            return prev + (cell.resource?.amount ?? 0);
        }, 0);
        
        if (state.outputRequests >= totalResources) {
            return "not-enough";
        }
        
        state.outputRequests++;
        evtBuildingStateChanged.post(instance);
        return "ok";
    }

    public static toggleAutoOutput(instance: IBuildingInstance) {
        const state = instance.state as IMineState;
        state.autoOutput = !state.autoOutput;
        evtBuildingStateChanged.post(instance);
    }

    public static getResourceType(instance: IBuildingInstance) {
        // assumes all resources under the mine are of the same type
        // good enough for the conference
        // TODO return multiple action buttons, one per resource type under the mine
        const state = instance.state as IMineState;
        if (state.depleted) {
            return null;
        }

        if (state.minedResource) {
            return state.minedResource;
        }

        const resourceCell = GameUtils.getCell(state.resourceCells[0])!;
        return resourceCell.resource!.type;
    }
}

