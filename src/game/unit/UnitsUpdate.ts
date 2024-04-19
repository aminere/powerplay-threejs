import { FlockProps } from "../components/Flock";
import { IUnit } from "./IUnit";
import { unitMotion } from "./UnitMotion";
import { time } from "../../engine/core/Time";
import { unitAnimation } from "./UnitAnimation";
import { ICharacterUnit } from "./ICharacterUnit";
import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from "three";

const pickedItemOffset = new Matrix4().makeTranslation(-.5, 0, 0);
const pickedAk47Offset = new Matrix4().compose(
    new Vector3(),
    new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(-158), MathUtils.degToRad(61), MathUtils.degToRad(-76))),
    new Vector3(1, 1, 1).multiplyScalar(1.5)
);
const pickedItemlocalToSkeleton = new Matrix4();

export function updateUnits(units: IUnit[]) {
    const props = FlockProps.instance;    
    const steerAmount = props.speed * time.deltaTime;
    const avoidanceSteerAmount = props.avoidanceSpeed * time.deltaTime;

    for (let i = 0; i < units.length; ++i) {
        const unit = units[i];
        if (!unit.isAlive) {
            continue;
        }

        unit.fsm.update();
        unitMotion.update(unit, steerAmount, avoidanceSteerAmount);

        switch (unit.type) {
            case "truck": {
                
            }
            break;

            case "worker": {
                const character = unit as ICharacterUnit;
                const resource = unit.resource;
                if (resource) {
                    // attach the resource to the unit
                    const visual = resource.visual;
                    const skeleton = unitAnimation.getSkeleton(character);
                    switch (resource.type) {
                        case "ak47": {
                            const parent = skeleton.getObjectByName("HandR")!;
                            pickedItemlocalToSkeleton.multiplyMatrices(parent.matrixWorld, pickedAk47Offset);
                            const muzzleFlash = visual.getObjectByName("muzzle-flash");
                            if (muzzleFlash) {
                                if (character.animation.name === "shoot") {
                                    if (character.muzzleFlashTimer < 0) {
                                        character.muzzleFlashTimer = MathUtils.randFloat(.05, .2);
                                        muzzleFlash.visible = !muzzleFlash.visible;
                                    } else {
                                        character.muzzleFlashTimer -= time.deltaTime;
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
                break;
        }
    }
}

