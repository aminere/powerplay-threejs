import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../CharacterUnit";
import { IUnit } from "../Unit";

export class SoldierState extends State<ICharacterUnit> {

    override enter(_unit: IUnit) {
    }

    override update(_unit: IUnit): void {        
    }
}

