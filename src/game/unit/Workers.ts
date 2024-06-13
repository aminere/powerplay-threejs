import { Euler, MathUtils, Matrix4, Quaternion, Vector2, Vector3 } from "three";
import { utils } from "../../engine/Utils";
import { meshes } from "../../engine/resources/Meshes";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { GameMapState } from "../components/GameMapState";
import { ICharacterUnit } from "./ICharacterUnit";
import { unitAnimation } from "./UnitAnimation";
import { time } from "../../engine/core/Time";

const pickedItemOffset = new Matrix4().makeTranslation(-.5, 0, 0);
const pickedAk47Offset = new Matrix4().compose(
    new Vector3(-.01, -.13, .02),
    new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(-129.8), MathUtils.degToRad(42.24), MathUtils.degToRad(-134.23))),
    new Vector3(1, 1, 1)
);
const pickedRPGOffset = new Matrix4().compose(
    new Vector3(-.04, .27, -.31),
    new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(-111.2), MathUtils.degToRad(-22.97), MathUtils.degToRad(105.58))),
    new Vector3(1, 1, 1).multiplyScalar(1.2)
);
const shootingRPGOffset = new Matrix4().compose(
    new Vector3(-.28, .22, .05),
    new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(109.82), MathUtils.degToRad(-19.49), MathUtils.degToRad(-157.42))),
    new Vector3(1, 1, 1).multiplyScalar(1.2)
);

const pickedItemlocalToSkeleton = new Matrix4();

export class Workers {

    public static update(unit: ICharacterUnit) {    
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
                case "rpg": {
                    const parent = skeleton.getObjectByName("HandR")!;
                    const matrix = unit.animation.name.startsWith("shoot") ? shootingRPGOffset : pickedRPGOffset;
                    pickedItemlocalToSkeleton.multiplyMatrices(parent.matrixWorld, matrix);                    
                }
                    break;
                default: {
                    const parent = skeleton.getObjectByName("Spine2")!;
                    pickedItemlocalToSkeleton.multiplyMatrices(parent.matrixWorld, pickedItemOffset);
                }
            }
            visual.matrix.multiplyMatrices(unit.visual.matrixWorld, pickedItemlocalToSkeleton);
        }
    }

    public static pickResource(unit: ICharacterUnit, resourceType: RawResourceType | ResourceType, mapCoords: Vector2) {
        const { pickedItems: layer } = GameMapState.instance.layers;
        const visual = utils.createObject(layer, resourceType);
        visual.matrixAutoUpdate = false;
        visual.matrixWorldAutoUpdate = false;
        const [_mesh] = meshes.loadImmediate(`/models/resources/${resourceType}.glb`);
        const mesh = _mesh.clone();
        visual.add(mesh);        
    
        mesh.castShadow = true;
        unit.resource = {
            visual,
            type: resourceType,
            sourceCell: mapCoords.clone()
        };
    
        visual.visible = false;
        setTimeout(() => { visual.visible = true }, 100); 
    }
}

