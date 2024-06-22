import { unitConfig } from "../../config/UnitConfig";
import { State } from "../../fsm/StateMachine";
import { ITankUnit } from "../TankUnit";
import { UnitSearch } from "../UnitSearch";
import { UnitUtils } from "../UnitUtils";
import { IVehicleUnit } from "../VehicleUnit";
import { TankAttackBuilding } from "./TankAttackBuilding";
import { TankAttackUnit } from "./TankAttackUnit";

export class IdleTank extends State<IVehicleUnit> {
    private _search = new UnitSearch();

    override update(unit: ITankUnit) {
        const { vision } = unitConfig[unit.type].range;
        const isEnemy = UnitUtils.isEnemy(unit);
        const targetUnit = this._search.find(unit, vision, target => UnitUtils.isEnemy(target) !== isEnemy);
        if (targetUnit) {
            const attack = unit.fsm.switchState(TankAttackUnit);
            attack.setTarget(targetUnit);
            this._search.reset();
            return;                      
        }

        if (UnitUtils.isEnemy(unit)) {
            const closestBuilding = this._search.findBuilding(unit, vision);
            if (closestBuilding) {
                const attack = unit.fsm.switchState(TankAttackBuilding);
                attack.setTarget(closestBuilding);
                return;
            }
        }
        
        unit.resetCannon();
    }
}

