import { Vector3 } from "three";
import { IUnit } from "./Unit";
import { IUnitAddr } from "./UnitAddr";
import { GameUtils } from "../GameUtils";


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

    public static applyElevation(coords: IUnitAddr, worldPos: Vector3) {
        worldPos.y = GameUtils.getMapHeight(coords.mapCoords, coords.localCoords, coords.sector, worldPos.x, worldPos.z);
    };
}

