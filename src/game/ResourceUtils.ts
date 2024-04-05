

import { Vector2 } from "three";
import { config } from "./config";
import { IUnit } from "./unit/IUnit";
import { ICell, ISector } from "./GameTypes";
import { utils } from "../engine/Utils";
import { meshes } from "../engine/resources/Meshes";
import { RawResourceType, ResourceType } from "./GameDefinitions";

const { cellSize } = config.game;

class ResourceUtils {

    public depositResource(unit: IUnit, cell: ICell, sector: ISector, localCoords: Vector2) {
        const resourceType = unit.resource!.type;
        console.assert(resourceType);
        console.assert(!cell.nonPickableResource);
        console.assert(cell.acceptsResource === resourceType);
        this.setResource(cell, sector, localCoords, resourceType);
        unit.resource!.visual.removeFromParent();
        unit.resource = null;
    }

    public setResource(cell: ICell, sector: ISector, localCoords: Vector2, resourceType: RawResourceType | ResourceType) {
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
    }
}

export const resourceUtils = new ResourceUtils();

