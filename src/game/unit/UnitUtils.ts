
import { Vector2 } from "three";
import { ICell, ISector } from "../GameTypes";
import { IUnit } from "./IUnit";
import { utils } from "../../engine/Utils";
import { config } from "../config";
import { meshes } from "../../engine/resources/Meshes";

const { cellSize } = config.game;

class UnitUtils {
    public depositResource(unit: IUnit, cell: ICell, sector: ISector, localCoords: Vector2) {
        const resourceType = unit.resource!.type;
        console.assert(resourceType);
        console.assert(!cell.nonPickableResource);
        console.assert(cell.acceptsResource === resourceType);
        const visual = utils.createObject(sector.layers.resources, resourceType);
        visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);
        meshes.load(`/models/resources/${resourceType}.glb`).then(([_mesh]) => {
            const mesh = _mesh.clone();
            visual.add(mesh);
            mesh.position.y = 0.5;
            mesh.castShadow = true;
        });
        cell.nonPickableResource = {
            type: resourceType,
            visual
        };
        unit.resource!.visual.removeFromParent();
        unit.resource = null;
    }
}

export const unitUtils = new UnitUtils();

