import { Euler, MathUtils, Matrix4, Quaternion, Vector2, Vector3 } from "three";
import { IUnit } from "./IUnit";
import { getCellFromAddr } from "./UnitAddr";
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
import { IVehicleUnit } from "./VehicleUnit";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { buildingConfig } from "../config/BuildingConfig";
import { unitMotion } from "./UnitMotion";

const direction = new Vector3();
const velocity = new Vector3();
const nextPos1 = new Vector3();
const nextPos2 = new Vector3();
const normal = new Vector3();
const forward = new Vector3();
const surfaceForward = new Vector3();
const quaternion = new Quaternion();
const matrix = new Matrix4();
const mapCoords = new Vector2();
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

    public static isBuildingOutOfRange(unit: IUnit, target: IBuildingInstance, radius: number) {        
        const { size } = buildingConfig[target.buildingType];
        const centerX = target.mapCoords.x + size.x / 2;
        const centerY = target.mapCoords.y + size.z / 2;
        const dx = Math.abs(centerX - unit.coords.mapCoords.x);
        const dy = Math.abs(centerY - unit.coords.mapCoords.y);
        return dx > radius || dy > radius;
    }

    public static isEnemy(unit: IUnit) {
        return unit.type.startsWith("enemy");
    }

    public static isWorker(unit: IUnit) {
        return unit.type === "worker";
    }

    public static isTank(unit: IUnit) {
        return unit.type.includes("tank");
    }

    public static isVehicle(unit: IUnit) {
        return VehicleTypes.includes(unit.type as VehicleType);
    }

    public static applyElevation(unit: IUnit) {
        const { coords, visual } = unit;
        if (UnitUtils.isVehicle(unit)) {
            visual.position.y = GameUtils.getMapHeightAndNormal(coords.mapCoords, coords.localCoords, coords.sector, visual.position.x, visual.position.z, normal);
            const vehicle = unit as IVehicleUnit;
            vehicle.normal.copy(normal);
        } else {
            visual.position.y = GameUtils.getMapHeight(coords.mapCoords, coords.localCoords, coords.sector, visual.position.x, visual.position.z);
        }
    }

    public static willCollide(unit1: IUnit, unit2: IUnit) {
        const unit1IsTruck = unit1.type === "truck";
        const unit2IsTruck = unit2.type === "truck";
        if (unit1IsTruck && unit2IsTruck) {
            const box1Pos = unit1.visual.localToWorld(truckWorldCorner1.copy(truckCorner));
            truckPoly1.pos.x = box1Pos.x;
            truckPoly1.pos.y = box1Pos.z;
            truckPoly1.setAngle(-unit1.angle);
            const box2Pos = unit2.visual.localToWorld(truckWorldCorner2.copy(truckCorner));
            truckPoly2.pos.x = box2Pos.x;
            truckPoly2.pos.y = box2Pos.z;
            truckPoly2.setAngle(-unit2.angle);
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
                const dt = time.deltaTime;
                velocity.copy(unit1.velocity).addScaledVector(unit1.acceleration, dt).clampLength(0, maxSpeed1);
                nextPos1.copy(unit1.visual.position).addScaledVector(velocity, dt);
                velocity.copy(unit2.velocity).addScaledVector(unit2.acceleration, dt).clampLength(0, maxSpeed2);
                nextPos2.copy(unit2.visual.position).addScaledVector(velocity, dt);
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
            const closestAngle = unit.angle + mathUtils.deltaAngle(unit.angle, angle);
            unit.angle = mathUtils.smoothDampAngle(unit.angle, closestAngle, halfDuration, time.deltaTime);            
            if (UnitUtils.isVehicle(unit)) {
                const vehicle = unit as IVehicleUnit;
                if (vehicle.normal.y < 1) {
                    forward.set(Math.sin(unit.angle), 0, Math.cos(unit.angle));
                    const right = forward.cross(vehicle.normal);
                    surfaceForward.crossVectors(vehicle.normal, right);
                    quaternion.setFromRotationMatrix(matrix.lookAt(GameUtils.vec3.zero, surfaceForward.negate(), vehicle.normal));
                    mathUtils.smoothDampQuat(unit.visual.quaternion, quaternion, .05, time.deltaTime);
                } else {
                    // moving on flat surface, keep it simple
                    quaternion.setFromAxisAngle(GameUtils.vec3.up, unit.angle);
                    mathUtils.smoothDampQuat(unit.visual.quaternion, quaternion, .01, time.deltaTime);
                }
            } else {
                unit.visual.quaternion.setFromAxisAngle(GameUtils.vec3.up, unit.angle);
            }
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

    public static getBuildingCenter(building: IBuildingInstance, centerOut: Vector2) {
        const { size } = buildingConfig[building.buildingType];
        centerOut.set(
            Math.floor(building.mapCoords.x + size.x / 2),
            Math.floor(building.mapCoords.y + size.z / 2)
        );
    }    

    public static moveToBuilding(unit: IUnit, building: IBuildingInstance) {
        UnitUtils.getBuildingCenter(building, mapCoords);
        unitMotion.moveUnit(unit, mapCoords, false);
    }
}

