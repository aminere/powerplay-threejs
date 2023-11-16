import { type Component, ComponentProps } from "./Component";
import { TestComponent, TestComponent2, TestComponentProps, TestComponentProps2 } from "./components/TestComponents";

class ComponentFactory {
    private _library = new Map<string, (props?: ComponentProps) => Component<ComponentProps>>();

    constructor() {
        this.register<TestComponentProps>(TestComponent);
        this.register<TestComponentProps2>(TestComponent2);
    }

    public register<T extends ComponentProps>(ctor: new (p?: T) => Component<T>) {
        this._library.set(ctor.name, (p?: ComponentProps) => new ctor(p as T));
    }

    public create(typename: string, props?: ComponentProps) {
        const creator = this._library.get(typename)!;
        return creator(props);
    }    

    public getTypes() {
        return this._library.keys();
    }    
}

export const componentFactory = new ComponentFactory();

