import { Object3D } from "three";

export interface IComponentProps { }
export interface IComponentState { }

export class Component<T extends IComponentProps, S extends IComponentState> {

    props: T;

    protected get _state(): S { return this["_state"] as S }

    constructor(props?: T) {
        this.props = props ?? {} as T;        
    }

    start(_owner: Object3D) { }

    update(_owner: Object3D) { }

    dispose() { }

    protected setState(state: S) {
        Object.defineProperty(this, '_state', { 
            enumerable: false, 
            get: () => state
        });
    }
}

export interface IComponentInstance<T extends Component<IComponentProps, IComponentState>> {
    owner: Object3D;
    component: T;
}

