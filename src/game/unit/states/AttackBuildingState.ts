import { State } from "../../fsm/StateMachine";
import { IUnit } from "../IUnit";

export class AttackBuildingState extends State<IUnit> {

    override enter(_unit: IUnit) {
        console.log("AttackBuildingState enter");
    }

    override update(_unit: IUnit) {
        
    }
}

