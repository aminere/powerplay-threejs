import { Euler, MathUtils, Quaternion, Vector3 } from "three";
import { IUnit } from "./IUnit";
import { IUnitAddr, getCellFromAddr } from "./UnitAddr";
import { GameUtils } from "../GameUtils";
import { VehicleType, VehicleTypes } from "../GameDefinitions";
import { Collision } from "../../engine/collision/Collision";
import { config } from "../config/config";
import { ITruckUnit } from "./TruckUnit";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/core/Time";
import { ICharacterUnit } from "./ICharacterUnit";
import { unitConfig } from "../config/UnitConfig";
import sat from "sat";

const direction = new Vector3();
const velocity = new Vector3();
const nextPos1 = new Vector3();
const nextPos2 = new Vector3();
const { separations, maxSpeed } = config.steering;

const baseRotations = {
    "shoot": new Quaternion().setFromEuler(new Euler(0, MathUtils.degToRad(12), 0)),
    "shoot-rpg": new Quaternion().setFromEuler(new Euler(0, MathUtils.degToRad(50), 0)),
    "attack": new Quaternion().setFromEuler(new Euler(0, MathUtils.degToRad(60), 0))
}

const { truckScale } = config.game;
const truckMin = new Vector3(-.3, 0, -1);
const truckMax = new Vector3(.3, .74, 1);
const truckPoly1 = new sat.Box(new sat.Vector(), truckScale * (truckMax.x - truckMin.x), truckScale * (truckMax.z - truckMin.z)).toPolygon();
const truckPoly2 = new sat.Box(new sat.Vector(), truckScale * (truckMax.x - truckMin.x), truckScale * (truckMax.z - truckMin.z)).toPolygon();
const truckCorner = new Vector3(truckMin.x, 0, truckMin.z);
const truckWorldCorner1 = new Vector3();
const truckWorldCorner2 = new Vector3();

function truckCollidesWithUnit(truck: ITruckUnit, unit: IUnit) {
    const maxSpeed1 = UnitUtils.getMaxSpeed(unit);
    velocity.copy(unit.velocity).addScaledVector(unit.acceleration, time.deltaTime).clampLength(0, maxSpeed1);
    nextPos1.copy(unit.visual.position).addScaledVector(velocity, time.deltaTime);
    return Collision.obbIntersectsSphere(truck.visual, truckMin, truckMax, nextPos1, separations[unit.type]);
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

    public static willCollide(unit1: IUnit, unit2: IUnit) {
        const unit1IsTruck = unit1.type === "truck";
        const unit2IsTruck = unit2.type === "truck";
        if (unit1IsTruck && unit2IsTruck) {
            const box1Pos = unit1.visual.localToWorld(truckWorldCorner1.copy(truckCorner));
            truckPoly1.pos.x = box1Pos.x;
            truckPoly1.pos.y = box1Pos.z;
            truckPoly1.setAngle(-unit1.visual.rotation.y);
            const box2Pos = unit2.visual.localToWorld(truckWorldCorner2.copy(truckCorner));
            truckPoly2.pos.x = box2Pos.x;
            truckPoly2.pos.y = box2Pos.z;
            truckPoly2.setAngle(-unit2.visual.rotation.y);
            const isColliding = sat.testPolygonPolygon(truckPoly1, truckPoly2);
            return isColliding;

        } else {
            if (unit1IsTruck) {
                return truckCollidesWithUnit(unit1 as ITruckUnit, unit2);
            } else if (unit2IsTruck) {
                return truckCollidesWithUnit(unit2 as ITruckUnit, unit1);
            } else {                
                // both have sphere collision
                // const dist = unit1.visual.position.distanceTo(unit2.visual.position);
                const maxSpeed1 = UnitUtils.getMaxSpeed(unit1);
                const maxSpeed2 = UnitUtils.getMaxSpeed(unit2);
                velocity.copy(unit1.velocity).addScaledVector(unit1.acceleration, time.deltaTime).clampLength(0, maxSpeed1);
                nextPos1.copy(unit1.visual.position).addScaledVector(velocity, time.deltaTime);
                velocity.copy(unit2.velocity).addScaledVector(unit2.acceleration, time.deltaTime).clampLength(0, maxSpeed2);
                nextPos2.copy(unit2.visual.position).addScaledVector(velocity, time.deltaTime);
                const dist = nextPos1.distanceTo(nextPos2);
                const separation = separations[unit1.type] + separations[unit2.type];
                return dist < separation;
            }
        }
    }

    public static updateRotation(unit: IUnit, _direction: Vector3, halfDuration: number) {
        if (_direction.lengthSq() > 0.001) {
            // direction.copy(_direction).normalize().negate();
            // unit.lookAt.setFromRotationMatrix(matrix.lookAt(GameUtils.vec3.zero, direction, GameUtils.vec3.up));
            // mathUtils.smoothDampQuat(unit.visual.quaternion, unit.lookAt, rotationDamp, time.deltaTime);
            direction.copy(_direction).normalize();
            const angle = Math.atan2(direction.x, direction.z);
            const closestAngle = unit.visual.rotation.y + mathUtils.deltaAngle(unit.visual.rotation.y, angle);
            unit.visual.rotation.y = mathUtils.smoothDampAngle(unit.visual.rotation.y, closestAngle, halfDuration, time.deltaTime);
        }
    }

    public static rotateToTarget(unit: IUnit, target: IUnit) {
        direction.subVectors(target!.visual.position, unit.visual.position);

        const animation = ((unit as ICharacterUnit)?.animation?.name ?? "") as keyof typeof baseRotations;
        const baseRotation = baseRotations[animation];
        if (baseRotation) {
            direction.normalize().applyQuaternion(baseRotation);
        }
        
        UnitUtils.updateRotation(unit, direction, .1);
    }

    public static slowDown(unit: IUnit) {
        const { arrivalDamping } = unitConfig[unit.type];
        mathUtils.smoothDampVec3(unit.velocity, GameUtils.vec3.zero, arrivalDamping, time.deltaTime);
        mathUtils.smoothDampVec3(unit.acceleration, GameUtils.vec3.zero, arrivalDamping, time.deltaTime);
    }

    public static getMaxSpeed(unit: IUnit) {
        if (UnitUtils.isVehicle(unit)) {
            const cell = getCellFromAddr(unit.coords);
            if (cell.roadTile) {
                return maxSpeed * 1.5;
            }
        }
        return maxSpeed;
    }
}

