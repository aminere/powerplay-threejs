
import { Constructor } from '../../engine/serialization/Types';

export class State<T> {
    enter(_owner: T) {}
    exit(_owner: T) {}
    update(_owner: T, _switchState: (state: Constructor<State<T>>) => void) {}
}

interface IStateMachineProps<T> {
    states: State<T>[];
    owner: T;
}

export class StateMachine<T> {

    public get owner() { return this._owner; }
    public get currentState() { return this._currentState; }

    private _states: Record<string, State<T>>;
    private _currentState: State<T> | null = null;
    protected _owner: T;

    constructor(props: IStateMachineProps<T>) {
        this._states = props.states.reduce((prev, cur) => ({ ...prev, [cur.constructor.name]: cur }), {});
        this._owner = props.owner;
    }

    public update() {
        this._currentState?.update(this._owner, state => this.switchState(state));
    }

    public switchState(state: Constructor<State<T>> | null) {
        const newState = state ? this._states[state.name] : null;
        this._currentState?.exit(this._owner);
        this._currentState = newState;
        newState?.enter(this._owner);
    }

    public getState<U>(state: Constructor<U>) {
        if (this._currentState?.constructor.name === state.name) {
            return this._currentState as U;
        } else {
            return null;
        }
    }
}

