import { Mesh, Object3D, ObjectLoader, SkinnedMesh } from "three";
import { Component, IComponentState } from "./Component";
import { componentFactory } from "./ComponentFactory";
import { utils } from "./Utils";
import { ComponentProps } from "./ComponentProps";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";

class Serialization {

    private _loader = new ObjectLoader();   

    public serialize(obj: Object3D, pretty = false) {
        if (obj.userData.unserializable) {
            console.log(`skipping serialization of ${obj.name}`);
            return null;
        }
        const data = (() => {   
            const skinnedMesh = obj as SkinnedMesh;
            if (skinnedMesh.isSkinnedMesh) {
                console.assert(false, "TODO: serialize skinned mesh");
                return obj.toJSON();
            }
            const skinnedMeshes = obj.getObjectsByProperty("isSkinnedMesh", true).filter(o => !o.userData.unserializable);
            const cloneUsingSkeletonUtils = skinnedMeshes.length > 0;            
            if (cloneUsingSkeletonUtils) {
                return SkeletonUtils.clone(obj).toJSON();
            } else {                
                return obj.toJSON();
            }
        })();
        
        if (pretty) {
            return JSON.stringify(data ?? "{}", null, 2);
        } else {
            return JSON.stringify(data ?? {});
        }
    }

    public deserialize(serialized: string, target?: Object3D) {
        const newInstance = this._loader.parse(JSON.parse(serialized));
        if (target) {            
            this.parallelTraverse(target, newInstance, (_target, _newInstance) => {
                if (_target.userData.unserializable) {
                    console.log(`skipping deserialization of ${_target.name}`);
                    return;
                }

                const liveUserData = _target.userData;
                if ((_target as SkinnedMesh).isSkinnedMesh) {
                    // Avoid affecting the existing skeleton
                    Mesh.prototype.copy.call(_target, _newInstance as Mesh, false);
                } else {
                    _target.copy(_newInstance, false);
                }                
                _target.userData = {
                    ...liveUserData,
                    ..._newInstance.userData
                };
                this.postDeserializeObject(_target);
    
                const { components } = _target.userData;
                if (components && liveUserData.components) {
                    for (const [key, value] of Object.entries(components)) {
                        const liveComponent = liveUserData.components[key];
                        const serializedInstance = value as Component<ComponentProps, IComponentState>;
                        const liveInstance = componentFactory.create(key, serializedInstance.props)!;
                        if (liveComponent) {
                            // keep the instance from the live component
                            // but assign to it fresh props from the serialized component
                            liveComponent.props = liveInstance.props;
                            components[key] = liveComponent;
                        } else {
                            components[key] = liveInstance
                        }
                    }
                }
            });
            return target;
        } else {
            this.postDeserialize(newInstance);
            return newInstance;
        }
    }    

    public postDeserialize(obj: Object3D) {
        obj.traverse(o => {
            this.postDeserializeObject(o);
            this.postDeserializeComponents(o);
        });
    }    

    private postDeserializeObject(obj: Object3D) {        
        const light = obj as THREE.DirectionalLight;
        if (light.isDirectionalLight) {
            utils.updateDirectionalLightTarget(light);
        }
        const { eulerRotation } = obj.userData;
        if (eulerRotation) {
            obj.rotation.copy(eulerRotation);
        }
    }

    private postDeserializeComponents(obj: Object3D) {
        const { components } = obj.userData;
        if (components) {
            for (const [key, value] of Object.entries(components)) {
                const serializedInstance = value as Component<ComponentProps, IComponentState>;
                const instance = componentFactory.create(key, serializedInstance.props);
                if (instance) {
                    components[key] = instance;
                } else {
                    console.warn(`Unknown component ${key}`);
                    delete components[key];
                }                
            }
        }
    }

    private parallelTraverse(a: Object3D, b: Object3D, callback: (a: Object3D, b: Object3D) => void) {
        callback(a, b);
        for (let i = 0; i < a.children.length; i++) {
            this.parallelTraverse(a.children[i], b.children[i], callback);
        }
    }    
}

export const serialization = new Serialization();

