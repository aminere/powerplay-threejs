import { utils } from "../../engine/Utils";
import { meshes } from "../../engine/resources/Meshes";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { GameMapState } from "../components/GameMapState";
import { IUnit } from "./IUnit";

class UnitUtils {
    public pickResource(unit: IUnit, resourceType: RawResourceType | ResourceType) {
        const { pickedItems: layer } = GameMapState.instance.layers;
        const visual = utils.createObject(layer, resourceType);
        visual.matrixAutoUpdate = false;
        visual.matrixWorldAutoUpdate = false;
        meshes.load(`/models/resources/${resourceType}.glb`).then(([_mesh]) => {
            const mesh = _mesh.clone();
            visual.add(mesh);
            mesh.castShadow = true;
        });

        unit.resource = {
            visual,
            type: resourceType
        };
    }
}

export const unitUtils = new UnitUtils();

