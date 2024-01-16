import { engineState } from "../../engine/EngineState";
import { Constructor } from "../../engine/Types";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { State, StateMachine } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";

export class UnitFSM extends StateMachine<IUnit> {
    public switchState(state: Constructor<State<IUnit>> | null) {        
        super.switchState(state);
        const isIdle = state === null;
        this._owner.isIdle = isIdle;
        if (!isIdle) {
            engineState.removeComponent(this._owner.obj, UnitCollisionAnim);
        }
    }
}

