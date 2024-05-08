import { State } from "../../fsm/StateMachine";
import { IUnit } from "../IUnit";

export class StateTemplate extends State<IUnit> {

    override enter(_unit: IUnit) {
    }

    override update(_unit: IUnit): void {        
    }
}

