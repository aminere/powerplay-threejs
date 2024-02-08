import { Constructor } from "../../engine/serialization/Types";
import { State, StateMachine } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";

export class UnitFSM extends StateMachine<IUnit> {
    public switchState(state: Constructor<State<IUnit>> | null) {        
        super.switchState(state);
        const isIdle = state === null;
        this._owner.isIdle = isIdle;        
    }
}

