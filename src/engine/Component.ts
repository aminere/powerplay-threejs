import { Object3D } from "three";

export interface IComponentProps { }

export class Component<T extends IComponentProps> {

    props: T;

    constructor(props?: T) {
        this.props = props ?? {} as T;
    }

    update(_owner: Object3D) { }

    dispose() { }
}

