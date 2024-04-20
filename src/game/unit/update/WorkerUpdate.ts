import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from "three";
import { time } from "../../../engine/core/Time";
import { unitAnimation } from "../UnitAnimation";
import { ICharacterUnit } from "../CharacterUnit";
import { RawResourceType, ResourceType } from "../../GameDefinitions";
import { GameMapState } from "../../components/GameMapState";
import { utils } from "../../../engine/Utils";
import { meshes } from "../../../engine/resources/Meshes";
import { objects } from "../../../engine/resources/Objects";

const pickedItemOffset = new Matrix4().makeTranslation(-.5, 0, 0);
const pickedAk47Offset = new Matrix4().compose(
    new Vector3(),
    new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(-158), MathUtils.degToRad(61), MathUtils.degToRad(-76))),
    new Vector3(1, 1, 1).multiplyScalar(1.5)
);
const pickedItemlocalToSkeleton = new Matrix4();

export function workerUpdate(unit: ICharacterUnit) {    
    const resource = unit.resource;
    if (resource) {
        // attach the resource to the unit
        const visual = resource.visual;
        const skeleton = unitAnimation.getSkeleton(unit);
        switch (resource.type) {
            case "ak47": {
                const parent = skeleton.getObjectByName("HandR")!;
                pickedItemlocalToSkeleton.multiplyMatrices(parent.matrixWorld, pickedAk47Offset);
                const muzzleFlash = visual.getObjectByName("muzzle-flash");
                if (muzzleFlash) {
                    if (unit.animation.name === "shoot") {
                        if (unit.muzzleFlashTimer < 0) {
                            unit.muzzleFlashTimer = MathUtils.randFloat(.05, .2);
                            muzzleFlash.visible = !muzzleFlash.visible;
                        } else {
                            unit.muzzleFlashTimer -= time.deltaTime;
                        }
                    } else {
                        muzzleFlash.visible = false;
                    }
                }
            }
                break;
            default: {
                const parent = skeleton.getObjectByName("Spine2")!;
                pickedItemlocalToSkeleton.multiplyMatrices(parent.matrixWorld, pickedItemOffset);
            }
        }
        visual.matrix.multiplyMatrices(unit.mesh.matrixWorld, pickedItemlocalToSkeleton);
    }
}

export function pickResource(unit: ICharacterUnit, resourceType: RawResourceType | ResourceType) {
    const { pickedItems: layer } = GameMapState.instance.layers;
    const visual = utils.createObject(layer, resourceType);
    visual.matrixAutoUpdate = false;
    visual.matrixWorldAutoUpdate = false;
    const [_mesh] = meshes.loadImmediate(`/models/resources/${resourceType}.glb`);
    const mesh = _mesh.clone();
    visual.add(mesh);

    if (resourceType === "ak47") {
        objects.load("/prefabs/muzzle-flash.json")
            .then(_obj => {
                const obj = _obj.clone();
                visual.add(obj);
                obj.visible = false;
            });
    }

    mesh.castShadow = true;
    unit.resource = {
        visual,
        type: resourceType
    };
}

