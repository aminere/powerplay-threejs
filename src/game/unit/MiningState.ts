import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";

export class MiningState extends State<IUnit> {
    override enter(_owner: IUnit) {
        console.log('enter mining state');
    }    
}

