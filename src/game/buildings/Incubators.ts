import { AdditiveBlending, DoubleSide, Material, Mesh, MeshBasicMaterial, Vector2 } from "three";
import { buildings } from "./Buildings";
import { IBuildingInstance, IIncubatorState } from "./BuildingTypes";
import { meshes } from "../../engine/resources/Meshes";
import { config } from "../config";
import { RawResourceType } from "../GameDefinitions";
import { time } from "../../engine/core/Time";
import { cmdSpawnUnit, evtBuildingStateChanged } from "../../Events";
import { buildingConfig } from "./BuildingConfig";
import { BuildingUtils } from "./BuildingUtils";

const { unitScale } = config.game;
const { inputCapacity: incubatorInputCapacity } = config.incubators;
const incubatorWater = new MeshBasicMaterial({ color: 0x084EBF, blending: AdditiveBlending, transparent: true });

const incubatorConfig = {
    productionTime: 2,
    inputAccepFrequency: 1,
    inputs: ["coal", "water"] as const
}

export class Incubators {
    public static create(sectorCoords: Vector2, localCoords: Vector2) {

        const instance = buildings.create("incubator", sectorCoords, localCoords);
        const state: IIncubatorState = {            
            active: false,
            progress: 0,
            reserve: {
                water: 0,
                coal: 0
            },
            inputFull: false,
            inputTimer: -1,
            water: null!,
            worker: null!
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
            mesh.scale.setScalar(unitScale);
            mesh.scale.setY(0);
            instance.visual.add(mesh);
            state.worker = mesh;
        });
    }

    public static update(instance: IBuildingInstance) {
        const state = instance.state as IIncubatorState;
        if (state.active) {

            let isDone = false;
            state.progress += time.deltaTime;
            if (state.progress > 1) {
                state.progress = 1;
                isDone = true;
            }

            state.worker.scale.setY(state.progress * unitScale);
            state.water.scale.setY(1 - state.progress);

            if (isDone) {
                state.active = false;
            }
        }

        if (!state.inputFull) {
            if (state.inputTimer < 0) {
                let accepted = false;
                let fullInputs = 0;

                for (const input of incubatorConfig.inputs) {
                    const currentAmount = state.reserve[input];
                    if (currentAmount < incubatorInputCapacity) {
                        if (BuildingUtils.tryGetFromAdjacentCells(instance, input)) {
                            state.reserve[input] = currentAmount + 1;
                            accepted = true;
                        }
                    } else {
                        fullInputs++;
                    }
                }

                if (accepted) {                    
                    evtBuildingStateChanged.post(instance);
                }

                state.inputTimer = incubatorConfig.inputAccepFrequency;
                if (fullInputs === incubatorConfig.inputs.length) {
                    state.inputFull = true;
                }

            } else {
                state.inputTimer -= time.deltaTime;
            }
        }        
    }

    public static tryDepositResource(instance: IBuildingInstance, _type: RawResourceType) {
        const state = instance.state as IIncubatorState;
        const type = _type as typeof incubatorConfig.inputs[number];
        if (!incubatorConfig.inputs.includes(type)) {            
            return false;
        }

        if (state.reserve[type] === incubatorInputCapacity) {            
            return false;
        }        

        if (type === "water") {
            const progress = state.reserve["water"] / incubatorInputCapacity;
            state.water.scale.setY(progress);
        }

        state.reserve[type]++;
        evtBuildingStateChanged.post(instance);
        return true;
    }

    public static spawn(instance: IBuildingInstance) {
        cmdSpawnUnit.post(instance);
        const state = instance.state as IIncubatorState;
        for (const input of incubatorConfig.inputs) {
            state.reserve[input]--;
        }
        const progress = state.reserve["water"] / incubatorInputCapacity;
        state.water.scale.setY(progress);
        evtBuildingStateChanged.post(instance);
        state.inputFull = false;
    }
}

