import { MathUtils, Vector2 } from "three";
import { config } from "./config";
import { ICell, ISector } from "./GameTypes";
import { utils } from "../powerplay";
import { meshes } from "../engine/resources/Meshes";
import { objects } from "../engine/resources/Objects";
import { ResourceType } from "./GameDefinitions";

const trees = [
    "palm.json",
    "palm-big",
    "palm-high"
];

const { cellSize } = config.game;

class Resources {
    public create(sector: ISector, localCoords: Vector2, cell: ICell, type: ResourceType) {
        const resource = utils.createObject(sector.layers.resources, type); 
        
        const fileName = (() => {
            if (type === "tree") {                
                return trees[MathUtils.randInt(0, trees.length - 1)];
            } else {
                return type;
            }
        })();

        if (fileName.endsWith(".json")) {
            objects.load(`/models/resources/${fileName}`)
                .then((obj) => {
                    resource.add(obj.clone());
                });
        } else {
            meshes.load(`/models/resources/${fileName}.glb`)
                .then((_meshes) => {
                    for (const _mesh of _meshes) {
                        const mesh = _mesh.clone();
                        mesh.castShadow = true;
                        resource.add(mesh);
                    }
                });
        }
        resource.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);
        cell.resource = resource;
        cell.isEmpty = false;
        cell.flowFieldCost = 0xffff;
    }

    public clear(sector: ISector, cell: ICell) {
        sector.layers.resources.remove(cell.resource!);
        delete cell.resource;
        console.assert(!cell.buildingId);
        cell.isEmpty = true;
        cell.flowFieldCost = 1;
    }
}

export const resources = new Resources();

