import { AnimationClip, Object3D } from "three";
import { Component, IComponentInstance } from "./Component";
import { ComponentProps } from "./ComponentProps";

class EngineState {

    public get components() { return this._componentsMap; }
    public get animations() { return this._animations; }

    private _componentsMap = new Map<string, IComponentInstance<Component<ComponentProps>>[]>();
    private _animations = new Map<string, {
        owner: Object3D;
        clip: AnimationClip;
    }>();

    public clear() {
        this._animations.clear();
        this._componentsMap.clear();
    }

    public setComponent<U extends Component<ComponentProps>>(owner: Object3D, component: U) {
        if (!("components" in owner.userData)) {
            owner.userData.components = {};
        }
        owner.userData.components[component.constructor.name] = component;
        this.registerComponent(component, owner);
        component.start(owner);
        return component;
    }

    public getComponents<U extends Component<ComponentProps>>(ctor: new () => U) {
        return this._componentsMap.get(ctor.name) as IComponentInstance<U>[];
    }

    public removeComponent<U extends Component<ComponentProps>>(owner: Object3D, ctor: new () => U) {
        const componentType = ctor.name;
        this.removeComponentByType(owner, componentType);
    }

    public removeComponentByType(owner: Object3D, componentType: string) {
        const instance = owner.userData.components?.[componentType] as Component<ComponentProps>;
        if (instance) {
            instance.dispose(owner);
            delete owner.userData.components[componentType];
            this.unregisterComponent(instance, owner);
        }
    }

    public removeObject(obj: Object3D) {
        const unregisterComponents = (_obj: Object3D) => {
            const components = _obj.userData.components;
            if (components) {
                for (const value of Object.values(components)) {
                    const instance = value as Component<ComponentProps>;
                    instance.dispose(_obj);
                    this.unregisterComponent(instance, _obj);
                }
            }
        }
        obj.traverse(o => {
            unregisterComponents(o);
            this.unregisterAnimations(o);
        });        
        obj.removeFromParent();
    }

    public registerComponent(component: Component<ComponentProps>, owner: Object3D) {
        const list = this._componentsMap.get(component.constructor.name);
        if (list) {
            list.push({ owner, component });
        } else {
            this._componentsMap.set(component.constructor.name, [{ owner, component }]);
        }
    }

    public unregisterComponent(component: Component<ComponentProps>, owner: Object3D) {
        const list = this._componentsMap.get(component.constructor.name);
        if (list) {
            const index = list.findIndex(i => i.owner === owner);
            if (index >= 0) {
                list.splice(index, 1);
            }
        }
    }

    public registerAnimations(obj: Object3D) {
        for (const anim of obj.animations) {
            const existing = this._animations.get(anim.name);
            if (!existing) {
                this._animations.set(anim.name, { owner: obj, clip: anim });
            } else {
                console.assert(false, `Anim '${anim.name}' (${obj.name}) ignored because it name-clashes with an existing anim.`);
            }
        }
    }

    private unregisterAnimations(obj: Object3D) {
        for (const anim of obj.animations) {
            this._animations.delete(anim.name);
        }
    }
}

export const engineState = new EngineState();

