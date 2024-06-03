import { AnimationClip, InstancedMesh, Object3D } from "three";
import { Component, IComponentInstance } from "./ecs/Component";
import { ComponentProps } from "./ecs/ComponentProps";
import { utils } from "./Utils";
import { Billboard } from "./components/Billboard";
import { InstancedParticles } from "./components/particles/InstancedParticles";

class EngineState {

    public get components() { return this._componentsMap; }
    public get animations() { return this._animations; }
    public get billboards() { return this._billboards; }
    public get instancedParticles() { return this._instancedParticles; }

    private _componentsMap = new Map<string, IComponentInstance<Component<ComponentProps>>[]>();
    private _componentsToRegister = new Array<IComponentInstance<Component<ComponentProps>>>();
    private _animations = new Map<string, {
        owner: Object3D;
        clip: AnimationClip;
    }>();
    private _billboards: Object3D[] = [];
    private _instancedParticles: InstancedMesh[] = [];

    public clear() {
        this._animations.clear();
        this._componentsMap.clear();
    }

    public setComponent<U extends Component<ComponentProps>>(owner: Object3D, component: U) {
        if (!("components" in owner.userData)) {
            owner.userData.components = {};
        }
        owner.userData.components[component.constructor.name] = component;
        this._componentsToRegister.push({ owner, component });
        component.start(owner);
        return component;
    }

    public getComponents<U extends Component<ComponentProps>>(ctor: new () => U) {
        const components = this._componentsMap.get(ctor.name) as IComponentInstance<U>[];
        return components.filter(c => c.component.props.active);
    }    

    public removeComponent<U extends Component<ComponentProps>>(ctor: new () => U, owner: Object3D) {
        const componentType = ctor.name;
        this.removeComponentByType(componentType, owner);
    }

    public removeComponentByType(componentType: string, owner: Object3D) {
        const instance = owner.userData.components?.[componentType] as Component<ComponentProps>;
        if (instance) {
            instance.dispose(owner);            
            this.unregisterComponent(instance, owner);
            delete owner.userData.components[componentType];
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
        const typename = component.constructor.name;
        const list = this._componentsMap.get(typename);
        if (list) {
            list.push({ owner, component });
        } else {
            this._componentsMap.set(typename, [{ owner, component }]);
        }
        
        switch (typename) {
            case Billboard.typename:
                this._billboards.push(owner);
                break;
            case InstancedParticles.typename:
                this._instancedParticles.push(owner as InstancedMesh);
                break;
        }

        component.mount(owner);
    }

    public unregisterComponent(component: Component<ComponentProps>, owner: Object3D) {
        const typename = component.constructor.name;
        const list = this._componentsMap.get(typename);
        if (list) {
            const index = list.findIndex(i => i.owner === owner);
            console.assert(index >= 0);
            utils.fastDelete(list, index);
        }

        switch (typename) {
            case Billboard.typename: {
                const index = this._billboards.indexOf(owner);
                console.assert(index >= 0);
                utils.fastDelete(this._billboards, index);
            }
                break;
            case InstancedParticles.typename: {
                const index = this._instancedParticles.indexOf(owner as InstancedMesh);
                console.assert(index >= 0);
                utils.fastDelete(this._instancedParticles, index);
            }
                break;
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

    public unregisterAnimations(obj: Object3D) {
        for (const anim of obj.animations) {
            this._animations.delete(anim.name);
        }
    }

    public handleComponentsToRegister() {
        if (this._componentsToRegister.length === 0) {
            return;
        }
        for (const instance of this._componentsToRegister) {
            this.registerComponent(instance.component, instance.owner);
        }
        this._componentsToRegister.length = 0;
    }
}

export const engineState = new EngineState();

