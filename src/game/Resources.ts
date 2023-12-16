import { MathUtils, Vector2 } from "three";
import { config } from "./config";
import { ICell, ISector } from "./GameTypes";
import { utils } from "../powerplay";
import { meshes } from "../engine/Meshes";
import { objects } from "../engine/Objects";

class Resources {

    private _resources = {
        "minerals": [
            "carbon",
            "iron-ore",
            "aluminium",
            "scandium"
        ],
        "trees": [
            "palm.json",
            "palm-big",
            "palm-high"            
        ]
    };

    public create(sector: ISector, localCoords: Vector2, cell: ICell, type: keyof typeof this._resources) {
        const resource = utils.createObject(sector.layers.resources, "resource");
        const list = this._resources[type];
        const index = MathUtils.randInt(0, list.length - 1);
        const name = list[index];
        if (name.endsWith(".json")) {
            objects.load(`/models/${type}/${name}`)
                .then((obj) => {
                    resource.add(obj.clone());
                });
        } else {
            meshes.load(`/models/${type}/${name}.glb`)
                .then((_meshes) => {
                    for (const _mesh of _meshes) {
                        const mesh = _mesh.clone();
                        mesh.castShadow = true;
                        resource.add(mesh);
                    }
                });
        }
        const { cellSize } = config.game;
        resource.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);
        cell.resource = resource;
    }

    public clear(sector: ISector, cell: ICell) {
        sector.layers.resources.remove(cell.resource!);
        delete cell.resource;
    }
}

export const resources = new Resources();

