import { Object3D } from "three";

export interface IComponentProps { }


export class Component<T extends IComponentProps> {

    props: T;

    constructor(props?: T) {
        this.props = props ?? {} as T;
    }

    start(_owner: Object3D) { }

    update(_owner: Object3D) { }

    dispose() { }
}

export interface IComponentInstance<T extends Component<IComponentProps>> {
    owner: Object3D;
    component: T;
}

