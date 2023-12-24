
import { Constructor } from "../../engine/Types";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";

export class MiningState extends State<IUnit> {
    override enter(unit: IUnit) {        
        unitUtils.moveTo(unit, unit.targetCell.mapCoords);
    }   
    
    override update(unit: IUnit, _switchState: (state: Constructor<State<IUnit>>) => void): void {
        if (unit.targetCell.mapCoords.equals(unit.coords.mapCoords)) {
        }        
    }
}

