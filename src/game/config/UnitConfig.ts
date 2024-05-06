import { UnitType } from "../GameDefinitions";

interface IUnitConfig {
    hitpoints: number;
}

export const unitConfig: Record<UnitType, IUnitConfig> = {
    "worker": {
        hitpoints: 10
    },
    "enemy-melee": {
        hitpoints: 10
    },
    "enemy-ranged": {
        hitpoints: 5
    },
    "tank": {
        hitpoints: 25
    },
    "truck": {
        hitpoints: 20
    }
};

