import { useEffect, useRef } from "react";
import { cmdImportObject } from "../Events";
import { Object3D, ObjectLoader } from "three";
import { addToScene } from "../Utils";
import { engine, serialization } from "powerplay-lib";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { state } from "../State";

async function importObject(file: File) {    
    const data = await file.arrayBuffer();
    const json = JSON.parse(new TextDecoder().decode(data));
    const obj = new ObjectLoader().parse(json) as Object3D;

    obj.traverse(o => {
        serialization.postDeserializeObject(o);
        serialization.postDeserializeComponents(o);
    });    

    const parent = state.selection ?? engine.scene!;
    const hasSkinnedMeshes = obj.children.some(c => c.type === "SkinnedMesh");
    if (hasSkinnedMeshes) {
        // make sure the object has a unique skeleton
        addToScene(SkeletonUtils.clone(obj), parent);
    } else {
        addToScene(obj, parent);
    }   
}

export function ObjectImporter() {
    
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onImport = () => {
            inputRef.current?.click();
        };
        cmdImportObject.attach(onImport);
        return () => {
            cmdImportObject.detach(onImport);
        }
    }, []);    

    return <input
        ref={inputRef}
        type="file"
        accept=".json"
        multiple
        style={{ display: "none" }}
        value={""} // ensure the change event fires when the same file is selected
        onChange={e => {
            if (!e.target.files) {
                return;
            }
            for (const file of e.target.files) {
                importObject(file);
            }            
        }}
    />;
}


