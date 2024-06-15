import { UnitType } from "../GameDefinitions";

const characterArrivalDamping = .05;
const vehicleArrivalDamping = .15;

interface IUnitConfig {
    hitpoints: number;
    damage: number;
    arrivalDamping: number;
    range: {
        vision: number;
        attack: number;
    };
}

export const unitConfig: Record<UnitType, IUnitConfig> = {
    "worker": {
        hitpoints: 20,
        damage: 2,
        arrivalDamping: characterArrivalDamping,
        range: {
            vision: 15,
            attack: 1
        }
    },
    "enemy-melee": {
        hitpoints: 20,
        damage: 2,
        arrivalDamping: characterArrivalDamping,
        range: {
            vision: 15,
            attack: 1
        }
    },    
    "tank": {
        hitpoints: 50,
        damage: 15,
        arrivalDamping: vehicleArrivalDamping,
        range: {
            vision: 20,
            attack: 15
        }
    },
    "enemy-tank": {
        hitpoints: 50,
        damage: 15,
        arrivalDamping: vehicleArrivalDamping,
        range: {
            vision: 30, // for demo
            attack: 15
        }
    },
    "truck": {
        hitpoints: 20,
        damage: 0,
        arrivalDamping: vehicleArrivalDamping,
        range: {
            vision: 20,
            attack: 0
        }
    }
};

