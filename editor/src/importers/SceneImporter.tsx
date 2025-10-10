import { useEffect, useRef } from "react";
import { cmdImportScene, cmdSaveScene } from "../Events";
import { engine } from "powerplay-lib";

async function importScene(file: File) {    
    const data = await file.arrayBuffer();
    const json = JSON.parse(new TextDecoder().decode(data));
    engine.parseScene(json);
    cmdSaveScene.post(false);
}

export function SceneImporter() {
    
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const onImport = () => {
            inputRef.current?.click();
        };
        cmdImportScene.attach(onImport);
        return () => {
            cmdImportScene.detach(onImport);
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
                importScene(file);
            }            
        }}
    />;
}


