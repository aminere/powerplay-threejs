
import { unitConfig } from "../../config/UnitConfig";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { UnitSearch } from "../UnitSearch";
import { UnitUtils } from "../UnitUtils";
import { AttackBuilding } from "./AttackBuilding";
import { AttackUnit } from "./AttackUnit";

export class IdleEnemy extends State<ICharacterUnit> {

    private _search = new UnitSearch();

    override update(unit: IUnit) {
        const { vision } = unitConfig[unit.type].range;        
        
        const targetUnit = this._search.find(unit, vision, target => !UnitUtils.isEnemy(target));
        if (targetUnit) {
            const attack = unit.fsm.switchState(AttackUnit);
            attack.setTarget(targetUnit);
            this._search.reset();
            return;
        }

        const closestBuilding = this._search.findBuilding(unit, vision);
        if (closestBuilding) {
            const attack = unit.fsm.switchState(AttackBuilding);
            attack.setTarget(closestBuilding);
            return;          
        }
    }
}

