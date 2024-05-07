import { UnitType } from "../GameDefinitions";

const characterArrivalDamping = .05;
const vehicleArrivalDamping = .15;

interface IUnitConfig {
    hitpoints: number;
    arrivalDamping: number;
}

export const unitConfig: Record<UnitType, IUnitConfig> = {
    "worker": {
        hitpoints: 10,
        arrivalDamping: characterArrivalDamping
    },
    "enemy-melee": {
        hitpoints: 10,
        arrivalDamping: characterArrivalDamping
    },
    "enemy-ranged": {
        hitpoints: 5,
        arrivalDamping: characterArrivalDamping
    },
    "tank": {
        hitpoints: 25,
        arrivalDamping: vehicleArrivalDamping
    },
    "truck": {
        hitpoints: 20,
        arrivalDamping: vehicleArrivalDamping
    }
};

