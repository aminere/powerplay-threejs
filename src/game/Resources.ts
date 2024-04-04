import { MathUtils, Vector2 } from "three";
import { config } from "./config";
import { ICell, IResource, ISector } from "./GameTypes";
import { utils } from "../powerplay";
import { meshes } from "../engine/resources/Meshes";
import { objects } from "../engine/resources/Objects";
import { RawResourceType } from "./GameDefinitions";

const trees = [
    "palm.json",
    "palm-big",
    "palm-high"
];

const { cellSize } = config.game;

class Resources {
    public create(sector: ISector, localCoords: Vector2, cell: ICell, type: RawResourceType) {
        const visual = utils.createObject(sector.layers.resources, type); 
        
        const fileName = (() => {
            if (type === "wood") {                
                return trees[MathUtils.randInt(0, trees.length - 1)];
            } else {
                return type;
            }
        })();

        if (fileName.endsWith(".json")) {
            objects.load(`/models/resources/${fileName}`)
                .then((obj) => {
                    visual.add(obj.clone());
                });
        } else {
            meshes.load(`/models/resources/${fileName}.glb`)
                .then((_meshes) => {
                    for (const _mesh of _meshes) {
                        const mesh = _mesh.clone();
                        mesh.castShadow = true;
                        visual.add(mesh);
                    }
                });
        }
        visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);

        const resourceInstance: IResource = {
            visual,
            type,
            amount: 100
        };

        cell.resource = resourceInstance;
    }

    public clear(cell: ICell) {
        cell.resource!.visual.removeFromParent();
        cell.resource = undefined;
    }
}

export const resources = new Resources();

