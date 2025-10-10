import { useEffect, useRef } from "react";
import { cmdImportImage } from "../Events";

type cmdImportImageCallback = (img: HTMLImageElement) => void;
async function importImage(file: File, onLoad: cmdImportImageCallback) {
    const reader = new FileReader();
    reader.addEventListener("load", e => {
        const img = document.createElement("img");
        const dataUrl = e.target?.result as string;
        img.addEventListener("load", () => onLoad(img));
        img.src = dataUrl;
    });
    reader.readAsDataURL(file);
}

export function ImageImporter() {

    const inputRef = useRef<HTMLInputElement>(null);
    const onLoadRef = useRef<cmdImportImageCallback>();

    useEffect(() => {
        const onImport = (onLoad: cmdImportImageCallback) => {
            onLoadRef.current = onLoad;
            inputRef.current?.click();
        };
        cmdImportImage.attach(onImport);
        return () => {
            cmdImportImage.detach(onImport);
        }        
    }, []);

    return <input
        ref={inputRef}
        type="file"
        accept="image.*"
        style={{ display: "none" }}
        value={""} // ensure the change event fires when the same file is selected
        onChange={e => {
            if (!e.target.files) {
                return;
            }
            for (const file of e.target.files) {
                importImage(file, onLoadRef.current!);
            }            
        }}
    />;
}


