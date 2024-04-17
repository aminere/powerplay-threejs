import { Constructor } from "../../engine/serialization/Types";
import { StateMachine } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";

export class UnitFSM extends StateMachine<IUnit> {
    public switchState<T>(state: Constructor<T> | null) {        
        const newState = super.switchState(state);
        const isIdle = state === null;
        this._owner.isIdle = isIdle;        
        return newState;
    }
}

