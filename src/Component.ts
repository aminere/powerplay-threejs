import { Object3D } from "three";

export interface ComponentProps { }

export class Component<T extends ComponentProps> {
    props: T;
    constructor(props?: T) {
        this.props = props ?? {} as T;
    }
    update(_owner: Object3D) { }

    // protected getComponent<U extends Component<ComponentProps>>(ctor: new () => U) {
    //     return this.owner.userData.components[ctor.name];
    // }
}

