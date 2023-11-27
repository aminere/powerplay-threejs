import { type Component, IComponentProps } from "./Component";

class ComponentFactory {
    private _library = new Map<string, (props?: IComponentProps) => Component<IComponentProps>>();    

    public register<T extends IComponentProps>(ctor: new (p?: T) => Component<T>) {
        this._library.set(ctor.name, (p?: IComponentProps) => new ctor(p as T));
    }

    public create(typename: string, props?: IComponentProps) {
        const creator = this._library.get(typename);
        return creator?.(props);
    }    

    public getTypes() {
        return this._library.keys();
    }    
}

export const componentFactory = new ComponentFactory();

