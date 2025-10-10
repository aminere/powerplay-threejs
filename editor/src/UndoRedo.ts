import { Matrix4, Object3D, SkinnedMesh } from "three";
import { state } from "./State";
import { cmdRefreshInspectors, cmdSaveScene, evtObjectChanged, evtObjectMoved } from "./Events";
import { getObjectAtPath, getObjectPath, removeFromScene, addToScene, isDescendant } from "./Utils";
import { serialization, engine } from "powerplay-lib";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";

class Operation {    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    apply(_undo: boolean) {}   
}

const undoStack: Operation[] = [];
const redoStack: Operation[] = [];

type ObjectAddress = {
    path: number[];
    uuid: string;
}

class ChangeOperation extends Operation {  
    protected _objectAddress: ObjectAddress;
    protected _objectState: string;

    constructor(objectAddress: ObjectAddress, objectState: string) {
        super();
        this._objectAddress = objectAddress;
        this._objectState = objectState;
    }

    override apply(undo: boolean) {
        const oldInstance = getObjectAtPath(this._objectAddress.path);
        if (oldInstance && oldInstance.uuid === this._objectAddress.uuid) {
            console.assert(oldInstance.parent !== null);
            if (undo) {
                redoStack.push(new ChangeOperation(this._objectAddress, serialization.serialize(oldInstance)!));
            } else {
                undoStack.push(new ChangeOperation(this._objectAddress, serialization.serialize(oldInstance)!));
            }
            serialization.deserialize(this._objectState, oldInstance);
            evtObjectChanged.post(oldInstance);            
            if (state.selection === oldInstance || isDescendant(oldInstance, state.selection!)) {
                cmdRefreshInspectors.post(oldInstance);
            }
            cmdSaveScene.post(false);
        }
    }
}

class DeleteOperation extends ChangeOperation {
    override apply(undo: boolean) {
        if (undo) {
            const parentPath = this._objectAddress.path.slice(0, -1);
            const parent = parentPath.length === 0 ? engine.scene! : getObjectAtPath(parentPath);
            if (parent) {
                const indexInParent = this._objectAddress.path[this._objectAddress.path.length - 1];
                const instance = serialization.deserialize(this._objectState);                
                addToScene(instance, parent, indexInParent);
                redoStack.push(new DeleteOperation(this._objectAddress, this._objectState));
            }
        } else {
            const instance = getObjectAtPath(this._objectAddress.path);
            if (instance && instance.uuid === this._objectAddress.uuid) {
                removeFromScene(instance);
                undoStack.push(new DeleteOperation(this._objectAddress, this._objectState));
            }
        }
    }
}

class MoveOperation extends Operation {
    private _srcPath: number[];
    private _destPath: number[];    
    constructor(srcPath: number[], destPath: number[]) {
        super();
        this._srcPath = srcPath;
        this._destPath = destPath;
    }

    override apply(undo: boolean) {
        const instance = getObjectAtPath(this._destPath);
        if (!instance) {
           return; 
        }
        const previousParent = instance.parent!;
        instance.removeFromParent();
        const parentPath = this._srcPath.slice(0, -1);
        const indexInParent = this._srcPath[this._srcPath.length - 1];
        const parent = parentPath.length === 0 ? engine.scene! : getObjectAtPath(parentPath);
        if (!parent) {
            return;
        }
        // preserve world transform
        const worldMatrix = new Matrix4().copy(parent.matrixWorld).invert();
        worldMatrix.multiply(previousParent.matrixWorld);
        instance.applyMatrix4(worldMatrix);
        parent.children.splice(indexInParent, 0, instance);
        instance.parent = parent;
        instance.updateWorldMatrix(false, true);

        evtObjectMoved.post({ srcPath: this._destPath, destPath: this._srcPath });
        cmdSaveScene.post(false);

        const moveOperation = new MoveOperation(this._destPath, [...parentPath, indexInParent]);
        if (undo) {
            redoStack.push(moveOperation);
        } else {
            undoStack.push(moveOperation);
        }
    }
}

class UndoRedo {

    private _objectState: string | null = null;
    private _objectAddr: ObjectAddress | null = null;

    public undo() {
        const operation = undoStack.pop();
        if (!operation) {
            return;
        }
        operation.apply(true);
    }

    public redo() {        
        const operation = redoStack.pop();
        if (!operation) {
            return;
        }
        operation.apply(false);
    }

    public recordState(obj: Object3D) {
        const skinnedMesh = obj as SkinnedMesh;
        if (skinnedMesh.isSkinnedMesh) {
            if (skinnedMesh.userData.unserializable) {
                return;
            }
            
            const rootBone = skinnedMesh.skeleton.bones[0];
            
            let commonAncestor = rootBone.parent!;
            while (commonAncestor && !isDescendant(commonAncestor, skinnedMesh)) {
                commonAncestor = commonAncestor.parent!;
            }

            if (commonAncestor) {
                this._objectAddr = { path: getObjectPath(commonAncestor), uuid: commonAncestor.uuid };
                this._objectState = serialization.serialize(commonAncestor);
                return;
            } else {
                console.assert(false, "No common ancestor found between a SkinnedMesh and its root bone.");
            }
        }

        this._objectState = serialization.serialize(obj);
        if (this._objectState) {
            this._objectAddr = { path: getObjectPath(obj), uuid: obj.uuid };
        }
    }

    public pushState() {
        if (!this._objectState) {
            return;
        }
        console.assert(this._objectAddr !== null);
        undoStack.push(new ChangeOperation(this._objectAddr!, this._objectState!));
        redoStack.length = 0;
    }

    public pushDeletion(obj: Object3D) {
        const skinnedMesh = obj as SkinnedMesh;
        if (skinnedMesh.isSkinnedMesh) {
            console.assert(false, "TODO: serialize skinned mesh");       
            return;
        }
        const copy = (() => {
            const skinnedMeshes = obj.getObjectsByProperty("type", "SkinnedMesh");
            if (skinnedMeshes.length > 0) {
                return SkeletonUtils.clone(obj);
            } else {
                return obj;
            }
        })();
        const objectAddr = { path: getObjectPath(obj), uuid: copy.uuid };
        const objectState = JSON.stringify(copy.toJSON());
        undoStack.push(new DeleteOperation(objectAddr, objectState));
        redoStack.length = 0;
    }
    
    public pushMove(srcPath: number[], destPath: number[]) {
        undoStack.push(new MoveOperation(srcPath, destPath));
        redoStack.length = 0;
    }

    public clear() {
        undoStack.length = 0;
        redoStack.length = 0;
    }
}

export const undoRedo = new UndoRedo();

