import { AdditiveBlending, DoubleSide, Material, Mesh, MeshBasicMaterial, Vector2 } from "three";
import { buildings } from "./Buildings";
import { IBuildingInstance, IIncubatorState, buildingSizes } from "./BuildingTypes";
import { meshes } from "../../engine/resources/Meshes";
import { config } from "../config";
import { RawResourceType } from "../GameDefinitions";
import { time } from "../../engine/core/Time";
import { cmdSpawnUnit, evtBuildingStateChanged } from "../../Events";

const { unitScale } = config.game;
const { capacity } = config.incubators;
const incubatorWater = new MeshBasicMaterial({ color: 0x084EBF, blending: AdditiveBlending, transparent: true });

export class Incubators {
    public static create(sectorCoords: Vector2, localCoords: Vector2) {

        const instance = buildings.create("incubator", sectorCoords, localCoords);
        const state: IIncubatorState = {            
            active: false,
            progress: 0,
            amount: {
                water: 0,
                coal: 0
            },
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
            const size = buildingSizes["incubator"];
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
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType) {

        const state = instance.state as IIncubatorState;
        switch (type) {
            case "water": {
                if (state.amount.water < capacity.water) {
                    state.amount.water++;
                    const progress = state.amount.water / capacity.water;
                    state.water.scale.setY(progress);
                    evtBuildingStateChanged.post(instance);
                    return true;
                }
            }
            break;

            case "coal": {
                if (state.amount.coal < capacity.coal) {
                    state.amount.coal++;
                    evtBuildingStateChanged.post(instance);
                    return true;
                }
            }
            break;
        }

        return false;
    }

    public static spawn(instance: IBuildingInstance) {
        cmdSpawnUnit.post(instance);
        const state = instance.state as IIncubatorState;
        state.amount.water--;
        state.amount.coal--;
        const progress = state.amount.water / capacity.water;
        state.water.scale.setY(progress);
        evtBuildingStateChanged.post(instance);
    }
}

