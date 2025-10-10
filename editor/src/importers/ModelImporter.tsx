import { useEffect, useRef } from "react";
import { FBXLoader, GLTFLoader } from "three/examples/jsm/Addons.js";
import { addToScene } from "../Utils";
import { cmdImportModel } from "../Events";
import { engine } from "powerplay-lib";
import { state } from "../State";
import { FrontSide, Mesh, Object3D } from "three";

function importMesh(scene: Object3D, parent: Object3D) {
    scene.traverse(child => {
        const mesh = child as Mesh;
        if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            if (Array.isArray(mesh.material)) {
                for (const material of mesh.material) {
                    material.side = FrontSide;
                }
            } else {
                mesh.material.side = FrontSide;
            }
        }
    });
    addToScene(scene, parent);
}

async function importGLTF(loader: GLTFLoader, file: File) {
    const data = await file.arrayBuffer();
    loader.parse(
        data,
        file.webkitRelativePath!,
        (gltf) => {
            gltf.scene.name = file.name;
            gltf.scene.animations = gltf.scene.animations.concat(gltf.animations);
            const parent = state.selection ?? engine.scene!;
            importMesh(gltf.scene, parent);
        },
        error => {
            console.error(error);
        }
    );
}

async function importFBX(loader: FBXLoader, file: File) {
    const data = await file.arrayBuffer();
    const fbx = loader.parse(data, file.webkitRelativePath!);
    fbx.name = file.name;
    const parent = state.selection ?? engine.scene!;
    importMesh(fbx, parent);
}

export function ModelImporter() {

    const gltfLoader = useRef(new GLTFLoader());
    const fbxLoader = useRef(new FBXLoader());
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onImport = () => {
            inputRef.current?.click();
        };
        cmdImportModel.attach(onImport);
        return () => {
            cmdImportModel.detach(onImport);
        }        
    }, []);    

    return <input
        ref={inputRef}
        type="file"
        accept=".glb,.gltf,.fbx"
        multiple
        style={{ display: "none" }}
        value={""} // ensure the change event fires when the same file is selected
        onChange={e => {
            if (!e.target.files) {
                return;
            }
            for (const file of e.target.files) {
                const ext = file.name.split(".").pop()!.toLowerCase();
                if (ext === "fbx") {
                    importFBX(fbxLoader.current, file);
                } else {
                    importGLTF(gltfLoader.current, file);
                }
            }            
        }}
    />;
}


