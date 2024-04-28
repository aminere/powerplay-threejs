import { DoubleSide, Material, Mesh, Vector2 } from "three";
import { buildings } from "./Buildings";
import { IIncubatorState, buildingSizes } from "./BuildingTypes";
import { meshes } from "../../engine/resources/Meshes";
import { config } from "../config";

const { unitScale } = config.game;

export class Incubators {
    public static create(sectorCoords: Vector2, localCoords: Vector2) {

        const instance = buildings.create("incubator", sectorCoords, localCoords);
        const state: IIncubatorState = {            
            active: false,
            progress: 0
        };

        instance.state = state;

        const mesh = instance.visual as Mesh;
        const material = mesh.material as Material;
        material.side = DoubleSide;
        meshes.load("/models/buildings/incubator-glass.glb").then(([mesh]) => {
            const glass = mesh.clone();
            glass.castShadow = true;
            const glassMaterial = glass.material as Material;
            glassMaterial.transparent = true;
            glassMaterial.opacity = 0.6;
            instance.visual.add(glass);
        });

        meshes.load("/models/characters/worker.glb").then(([mesh]) => {            
            const worker = mesh.clone();
            const size = buildingSizes["incubator"];
            worker.position.set(size.x / 2, 0, size.z / 2);
            worker.scale.setScalar(unitScale);
            instance.visual.add(worker);
        });
    }
}

