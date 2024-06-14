import { UnitType } from "../GameDefinitions";

const characterArrivalDamping = .05;
const vehicleArrivalDamping = .15;

interface IUnitConfig {
    hitpoints: number;
    damage: number;
    arrivalDamping: number;
}

export const unitConfig: Record<UnitType, IUnitConfig> = {
    "worker": {
        hitpoints: 100,
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
    "tank": {
        hitpoints: 250,
        damage: 5,
        arrivalDamping: vehicleArrivalDamping
    },
    "truck": {
        hitpoints: 20,
        damage: 0,
        arrivalDamping: vehicleArrivalDamping
    }
};

