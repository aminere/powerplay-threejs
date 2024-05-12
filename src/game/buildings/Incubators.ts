import { AdditiveBlending, DoubleSide, Material, MathUtils, Mesh, MeshBasicMaterial, Vector2 } from "three";
import { buildings } from "./Buildings";
import { IBuildingInstance, IIncubatorState } from "./BuildingTypes";
import { meshes } from "../../engine/resources/Meshes";
import { config } from "../config/config";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { time } from "../../engine/core/Time";
import { cmdSpawnUnit, evtBuildingStateChanged } from "../../Events";
import { buildingConfig } from "../config/BuildingConfig";
import { BuildingUtils } from "./BuildingUtils";
import { resourceConfig } from "../config/ResourceConfig";

const { unitScale } = config.game;
const { inputCapacity, productionTime } = config.incubators;
const incubatorWater = new MeshBasicMaterial({ color: 0x084EBF, blending: AdditiveBlending, transparent: true });
const { inputAccepFrequency } = config.incubators;

function canOutput(incubator: IIncubatorState) {
    const inputs = resourceConfig.incubatorProduction["worker"];
    for (const [type, amount] of inputs) {
        const reserve = incubator.reserve.get(type) ?? 0;
        if (reserve < amount) {
            return false;
        }
    }    
    return true;
}

function canAcceptResource(instance: IBuildingInstance, type: ResourceType | RawResourceType) {
    const state = instance.state as IIncubatorState;
    const inputs = resourceConfig.incubatorProduction["worker"];
    for (const [input] of inputs) {
        if (input === type) {
            const currentAmount = state.reserve.get(type) ?? 0;
            if (currentAmount < inputCapacity) {
                return true;
            }
        }
    }
    return false;
}

export class Incubators {
    public static create(sectorCoords: Vector2, localCoords: Vector2) {

        const instance = buildings.create("incubator", sectorCoords, localCoords);
        const state: IIncubatorState = {            
            active: false,
            productionTimer: 0,
            reserve: new Map(),
            inputFull: false,
            inputTimer: -1,
            water: null!,
            worker: null!,
            outputRequests: 0
        };

        instance.state = state;

        const mesh = instance.visual as Mesh;
        const material = mesh.material as Material;
        material.side = DoubleSide;
        mesh.receiveShadow = false;

        meshes.load("/models/buildings/incubator-water.glb").then(([_mesh]) => {
            const mesh = _mesh.clone();            
            mesh.scale.setY(0);
            mesh.material = incubatorWater;
            instance.visual.add(mesh);
            state.water = mesh;
        });

        meshes.load("/models/buildings/incubator-glass.glb").then(([_mesh]) => {
            const mesh = _mesh.clone();
            mesh.castShadow = true;
            const glass = mesh.material as Material;
            glass.transparent = true;
            glass.opacity = 0.6;
            mesh.renderOrder = 1;
            instance.visual.add(mesh);
        });

        meshes.load("/models/characters/worker.glb").then(([_mesh]) => {            
            const mesh = _mesh.clone();            
            const size = buildingConfig["incubator"].size;
            mesh.position.set(size.x / 2, 0, size.z / 2);
            mesh.visible = false;
            instance.visual.add(mesh);
            state.worker = mesh;
        });
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IIncubatorState;
        if (state.active) {

            let isDone = false;
            state.productionTimer += time.deltaTime;

            let progress = state.productionTimer / productionTime;
            if (state.productionTimer > productionTime) {
                state.productionTimer = productionTime;
                progress = 1;
                isDone = true;
            }

            state.worker.scale.setScalar(progress * unitScale);
            const waterAmount = state.outputRequests + state.reserve.get("water")!;
            const waterSrcProgress = waterAmount / inputCapacity;
            const waterDestProgress = (waterAmount - 1) / inputCapacity;
            state.water.scale.setY(MathUtils.lerp(waterSrcProgress, waterDestProgress, progress));

            if (isDone) {
                state.water.scale.setY(waterDestProgress);                
                cmdSpawnUnit.post([instance, "worker"]);

                state.outputRequests--;
                if (state.outputRequests > 0) {
                    state.productionTimer = 0;
                } else {
                    state.worker.visible = false;
                    state.active = false;                    
                }
            }

            evtBuildingStateChanged.post(instance);

        } else {
            if (state.outputRequests > 0) {                
                state.productionTimer = 0;
                state.worker.visible = true;
                state.worker.scale.setScalar(0);
                state.active = true;
                evtBuildingStateChanged.post(instance);
            }
        }

        if (!state.inputFull) {
            if (state.inputTimer < 0) {
                let accepted = false;
                let fullInputs = 0;

                const inputs = resourceConfig.incubatorProduction["worker"];
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

    public static tryDepositResource(instance: IBuildingInstance, type: ResourceType | RawResourceType) {
        if (canAcceptResource(instance, type)) {
            const state = instance.state as IIncubatorState;
            const currentAmount = state.reserve.get(type) ?? 0;
            state.reserve.set(type, currentAmount + 1);
            if (type === "water") {
                const progress = state.reserve.get(type)! / inputCapacity;
                state.water.scale.setY(progress);
            }
            evtBuildingStateChanged.post(instance);
            return true;
        }
        return false;
    }

    public static output(instance: IBuildingInstance) {        
        const state = instance.state as IIncubatorState;
        if (!canOutput(state)) {
            return false;
        }
        state.outputRequests++;
        const inputs = resourceConfig.incubatorProduction["worker"];
        for (const [input, amount] of inputs) {
            const reserve = state.reserve.get(input)!;
            state.reserve.set(input, reserve - amount);
        }
        state.inputFull = false;
        evtBuildingStateChanged.post(instance);
        return true;
    }
}

