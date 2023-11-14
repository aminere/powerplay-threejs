import { type Component, ComponentProps } from "./Components";
import { TestComponent, TestComponentProps } from "./components/TestComponents";

class ComponentFactory {
    private _library = new Map<string, (props?: ComponentProps) => Component>();

    constructor() {
        this.register<TestComponentProps>(TestComponent);  
    }

    public register<props>(ctor: new (p?: props) => Component) {
        this._library.set(ctor.name, (p?: ComponentProps) => new ctor(p as props));
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

