import { UnitType } from "../GameDefinitions";

const characterArrivalDamping = .05;
const vehicleArrivalDamping = .15;

interface IUnitConfig {
    hitpoints: number;
    damage: number;
    arrivalDamping: number;
}

const tankConfig: IUnitConfig = {
    hitpoints: 50,
    damage: 15,
    arrivalDamping: vehicleArrivalDamping
}

export const unitConfig: Record<UnitType, IUnitConfig> = {
    "worker": {
        hitpoints: 20,
        damage: 2,
        arrivalDamping: characterArrivalDamping
    },
    "enemy-melee": {
        hitpoints: 20,
        damage: 2,
        arrivalDamping: characterArrivalDamping
    },
    "enemy-ranged": {
        hitpoints: 5,
        damage: 2,
        arrivalDamping: characterArrivalDamping
    },
    "tank": tankConfig,
    "enemy-tank": tankConfig,
    "truck": {
        hitpoints: 20,
        damage: 0,
        arrivalDamping: vehicleArrivalDamping
    }
};

