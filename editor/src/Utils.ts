import { AmbientLight, BoxGeometry, DirectionalLight, MathUtils, Mesh, MeshStandardMaterial, Object3D, PerspectiveCamera, Quaternion, Scene } from "three";
import { state } from "./State";
import { cmdSaveScene, evtObjectCreated, evtObjectDeleted } from "./Events";
import { Component, ComponentProps, engine, engineState, utils } from "powerplay-lib";

const identityRotation = new Quaternion();

export function addToScene(obj: Object3D, parent: Object3D, indexInParent?: number) {

    obj.traverse(o => {
        if (!o.quaternion.equals(identityRotation)) {
            o.userData.eulerRotation = o.rotation.clone();
        }
    });

    if (indexInParent !== undefined) {
        parent.children.splice(indexInParent, 0, obj);
        obj.parent = parent;
    } else {
        parent.add(obj);
    }
    evtObjectCreated.post(obj);
    cmdSaveScene.post(false);
    
    const registerComponents = (_obj: Object3D) => {
        const components = _obj.userData.components;
        if (components) {
            for (const component of Object.values(components)) {
                const instance = component as Component<ComponentProps>;
                if (state.engineStatus !== "stopped") {
                    instance.start(_obj);
                }
                engineState.registerComponent(instance, _obj);
            }
        }
    }
    
    obj.traverse(registerComponents);
    obj.traverse(o => engineState.registerAnimations(o));
}

export function removeFromScene(obj: Object3D) {
    if (state.selection === obj) {
        state.selection = null;
    }
    evtObjectDeleted.post(obj);
    engineState.removeObject(obj);
    utils.disposeObject(obj);
    cmdSaveScene.post(false);

}

export function ensurePow2Image(image: HTMLImageElement) {
    const widthPow2 = MathUtils.isPowerOfTwo(image.width);
    const heightPow2 = MathUtils.isPowerOfTwo(image.height);
    if (widthPow2 && heightPow2) {        
        return Promise.resolve(image);
    }
    return new Promise<HTMLImageElement>((resolve, reject) => {
        const newWidth = widthPow2 ? image.width : MathUtils.ceilPowerOfTwo(image.width);
        const newHeight = heightPow2 ? image.height : MathUtils.ceilPowerOfTwo(image.height);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d") as CanvasRenderingContext2D;
        canvas.width = newWidth;
        canvas.height = newHeight;
        context.drawImage(image, 0, 0, newWidth, newHeight);
        const pow2Image = new Image();
        pow2Image.onload = () => resolve(pow2Image);
        pow2Image.onerror = () => reject();
        pow2Image.src = canvas.toDataURL();
    });
}

export function getObjectPath(obj: Object3D): number[] {
    const path = [];
    while (obj.parent) {
        path.push(obj.parent.children.indexOf(obj));
        obj = obj.parent;
    }
    return path.reverse();
}

export function getObjectAtPath(path: number[]) {
    if (path[0] >= engine.scene!.children.length) {
        return null;
    }

    let obj = engine.scene!.children[path[0]];
    for (let i = 1; i < path.length; i++) {
        if (path[i] >= obj.children.length) {
            return null;
        }
        obj = obj.children[path[i]];
    }

    return obj;
}

export function getObjectName(obj: Object3D) {
    if (obj.name?.length > 0) {
        return obj.name;
    }
    return obj.constructor.name;
}

export function pathEquals(path1: number[], path2: number[]) {
    if (path1.length !== path2.length) {
        return false;
    }
    for (let i = 0; i < path1.length; ++i) {
        if (path1[i] !== path2[i]) {
            return false;
        }
    }
    return true;
}

export function initDirectionalLight(light: DirectionalLight) {
    light.position.set(2, 20, 3);
    light.rotation.set(MathUtils.degToRad(-80), MathUtils.degToRad(20), 0, 'YXZ');
    light.userData.eulerRotation = light.rotation.clone();
    utils.updateDirectionalLightTarget(light);
}

export function createNewScene() {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    camera.position.set(4, 3, 4);
    camera.rotation.set(MathUtils.degToRad(-30), MathUtils.degToRad(45), 0, 'YXZ');
    camera.userData.eulerRotation = camera.rotation.clone();
    scene.add(camera);
    const ambient = new AmbientLight(0xffffff, .2);
    scene.add(ambient);
    const light = new DirectionalLight(0xffffff, 1);
    light.castShadow = true;
    light.shadow.mapSize.width = 2048;
    light.shadow.mapSize.height = 2048;
    light.shadow.camera.near = 0.1;
    light.shadow.camera.far = 50;
    initDirectionalLight(light);
    scene.add(light);
    const cube = new Mesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ color: 0xffffff }));
    cube.name = "Cube";
    cube.castShadow = true;
    scene.add(cube);
    scene.updateWorldMatrix(true, true);
    return scene;
}

export async function loadDefaultGameScene() {
    const basePath = utils.getBasePath();
    const fullPath = `${basePath}scenes/sandbox.json`;
    const response = await fetch(fullPath);
    const data = await response.json();
    return data;
}

export function setComponent<U extends Component<ComponentProps>>(owner: Object3D, component: U) {
    if (!("components" in owner.userData)) {
        owner.userData.components = {};
    }
    owner.userData.components[component.constructor.name] = component;
    return component;
}

export function isDescendant(parent: Object3D, descendant: Object3D) {
    let current = descendant;
    while (current && current.parent) {
        if (current.parent === parent) {
            return true;
        }
        current = current.parent;
    }
    return false;
}

