import { MathUtils, Matrix4, Quaternion, Vector3 } from "three";
import { IUnit } from "./IUnit";
import { IUnitAddr } from "./UnitAddr";
import { GameUtils } from "../GameUtils";
import { VehicleType, VehicleTypes } from "../GameDefinitions";
import { Collision } from "../../engine/collision/Collision";
import { config } from "../config/config";
import { ITruckUnit } from "./TruckUnit";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/core/Time";
import { ICharacterUnit } from "./ICharacterUnit";
import { unitConfig } from "../config/UnitConfig";

const deltaPos = new Vector3();
const matrix = new Matrix4();

const { separations } = config.steering;

const baseRotations = {
    "shoot": new Quaternion().setFromAxisAngle(GameUtils.vec3.up, MathUtils.degToRad(12)),
    "attack": new Quaternion().setFromAxisAngle(GameUtils.vec3.up, MathUtils.degToRad(60))
}

const truckMin = new Vector3(-.3, 0, -1);
const truckMax = new Vector3(.3, .74, 1);
const truckCollisionSphere1 = new Vector3(0, .74 / 2, .5);
const truckCollisionSphere2 = new Vector3(0, .74 / 2, -.5);
const truckCollisionSphere1World = new Vector3();
const truckCollisionSphere2World = new Vector3();
function truckCollidesWithUnit(truck: ITruckUnit, unit: IUnit) {
    return Collision.obbIntersectsSphere(truck.visual, truckMin, truckMax, unit.visual.position, separations[unit.type] / 2);
}

export class UnitUtils {
    public static isOutOfRange(unit: IUnit, target: IUnit, radius: number) {
        const dx = Math.abs(target.coords.mapCoords.x - unit.coords.mapCoords.x);
        const dy = Math.abs(target.coords.mapCoords.y - unit.coords.mapCoords.y);
        return dx > radius || dy > radius;
    }

    public static isEnemy(unit: IUnit) {
        return unit.type.startsWith("enemy");
    }

    public static isWorker(unit: IUnit) {
        return unit.type === "worker";
    }

    public static isVehicle(unit: IUnit) {
        return VehicleTypes.includes(unit.type as VehicleType);
    }

    public static applyElevation(coords: IUnitAddr, worldPos: Vector3) {
        worldPos.y = GameUtils.getMapHeight(coords.mapCoords, coords.localCoords, coords.sector, worldPos.x, worldPos.z);
    }

    public static collides(unit1: IUnit, unit2: IUnit) {
        const unit1IsTruck = unit1.type === "truck";
        const unit2IsTruck = unit2.type === "truck";
        if (unit1IsTruck && unit2IsTruck) {
            unit2.visual.localToWorld(truckCollisionSphere1World.copy(truckCollisionSphere1));
            unit2.visual.localToWorld(truckCollisionSphere2World.copy(truckCollisionSphere2));
            if (Collision.obbIntersectsSphere(unit1.visual, truckMin, truckMax, truckCollisionSphere1World, 1)) {
                return true;
            }
            if (Collision.obbIntersectsSphere(unit1.visual, truckMin, truckMax, truckCollisionSphere2World, 1)) {
                return true;
            }
            return false;
        } else {
            if (unit1IsTruck) {
                return truckCollidesWithUnit(unit1 as ITruckUnit, unit2);
            } else if (unit2IsTruck) {
                return truckCollidesWithUnit(unit2 as ITruckUnit, unit1);
            } else {
                // both have sphere collision
                const dist = unit1.visual.position.distanceTo(unit2.visual.position);
                const separation = Math.max(separations[unit1.type], separations[unit2.type]);
                return dist < separation;
            }
        }
    }

    public static updateRotation(unit: IUnit, fromPos: Vector3, toPos: Vector3) {
        deltaPos.subVectors(toPos, fromPos);
        const deltaPosLen = deltaPos.length();
        if (deltaPosLen > 0.01) {
            deltaPos.divideScalar(deltaPosLen);
            unit.lookAt.setFromRotationMatrix(matrix.lookAt(GameUtils.vec3.zero, deltaPos.negate(), GameUtils.vec3.up));
            const rotationDamp = 0.1;
            mathUtils.smoothDampQuat(unit.visual.quaternion, unit.lookAt, rotationDamp, time.deltaTime);
        }
    }

    public static rotateToTarget(unit: IUnit, target: IUnit) {
        deltaPos.subVectors(target!.visual.position, unit.visual.position);

        const animation = ((unit as ICharacterUnit)?.animation?.name ?? "") as keyof typeof baseRotations;
        const baseRotation = baseRotations[animation];
        if (baseRotation) {
            deltaPos.applyQuaternion(baseRotation);
        }
        
        const targetPos = deltaPos.add(unit.visual.position);
        UnitUtils.updateRotation(unit, unit.visual.position, targetPos);
    }

    public static slowDown(unit: IUnit) {
        const { arrivalDamping } = unitConfig[unit.type];
        mathUtils.smoothDampVec3(unit.velocity, GameUtils.vec3.zero, arrivalDamping, time.deltaTime);
        mathUtils.smoothDampVec3(unit.acceleration, GameUtils.vec3.zero, arrivalDamping, time.deltaTime);
    }
}

