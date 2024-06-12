import { Euler, MathUtils, Matrix4, Quaternion, Vector2, Vector3 } from "three";
import { utils } from "../../engine/Utils";
import { meshes } from "../../engine/resources/Meshes";
import { objects } from "../../engine/resources/Objects";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { GameMapState } from "../components/GameMapState";
import { ICharacterUnit } from "./ICharacterUnit";
import { unitAnimation } from "./UnitAnimation";
import { SoldierState } from "./states/SoldierState";
import { time } from "../../engine/core/Time";

const pickedItemOffset = new Matrix4().makeTranslation(-.5, 0, 0);
const pickedAk47Offset = new Matrix4().compose(
    new Vector3(),
    new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(-158), MathUtils.degToRad(61), MathUtils.degToRad(-76))),
    new Vector3(1, 1, 1).multiplyScalar(1.5)
);
const pickedRPGOffset = new Matrix4().compose(
    new Vector3(0, .2, 0),
    new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(-43.45), MathUtils.degToRad(25.61), MathUtils.degToRad(16.95))),
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
                    pickedItemlocalToSkeleton.multiplyMatrices(parent.matrixWorld, pickedRPGOffset);                    
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
    
        switch (resourceType) {
            case "ak47": {
                const _muzzleFlash = objects.loadImmediate("/prefabs/muzzle-flash.json")!;
                const muzzleFlash = _muzzleFlash.clone();
                visual.add(muzzleFlash);
                muzzleFlash.visible = false;
                unit.fsm.switchState(SoldierState);
            }
            break;
            case "rpg": {
                unit.fsm.switchState(SoldierState);
            }
            break;
        }        
    
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

