import { Object3D } from "three";
import { ComponentProps } from "./ComponentProps";

export interface IComponentState { }

export class Component<T extends ComponentProps, S extends IComponentState = {}> {

    props: T;

    protected get state() { return (this as any)["_state"] as S }

    constructor(props?: T) {
        this.props = props ?? {} as T;        
    }

    start(_owner: Object3D) { }

    update(_owner: Object3D) { }

    dispose(_owner: Object3D) { }

    protected setState(state: S) {
        Object.defineProperty(this, '_state', { 
            enumerable: false, 
            get: () => state
        });
    }
}

export interface IComponentInstance<T extends Component<ComponentProps, IComponentState>> {
    owner: Object3D;
    component: T;
}

