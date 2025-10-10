import { Texture } from "three";
import { cmdImportImage } from "../Events";
import { ensurePow2Image } from "../Utils";
import { useState } from "react";
import { Button, HTMLSelect } from "@blueprintjs/core";

interface IProps {
    target: object;
    property: string;
    onBeforeChange: () => void;
    onChanged: () => void;
}

export function TexturePicker(props: IProps) {
    const { target, property, onBeforeChange, onChanged } = props;

    const [path, setPath] = useState((() => {
        const texture = target[property as keyof typeof target] as Texture;
        if (texture) {
            if (texture.image instanceof ImageBitmap) {
                // TODO
                console.warn(`TODO draw ImageBitmap ${property}`);
            } else {
                return texture.image?.src;
            }
        }
    })());

    const importImage = () => {
        cmdImportImage.post(img => {
            ensurePow2Image(img)
                .then(pow2Img => {
                    const oldTexture = target[property as keyof typeof target] as Texture;
                    if (oldTexture) {
                        oldTexture.dispose();
                    }
                    const newTexture = new Texture();
                    newTexture.image = pow2Img;
                    newTexture.needsUpdate = true;
                    onBeforeChange();
                    Object.assign(target, { [property]: newTexture });                    
                    onChanged();
                    setPath(pow2Img.src);
                });
        });
    };

    if (!path) {
        return <HTMLSelect
            fill
            minimal
            value={"None"}
            options={["None", "Browse"]}
            onChange={e => {
                if (e.currentTarget.value === "Browse") {
                    importImage();
                }
            }}
        />
    } else {
        return <div style={{
            display: "flex",
        }}>
            <div
                style={{
                    width: "50px",
                    height: "30px",
                    backgroundImage: path ? `url(${path})` : undefined,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    cursor: "pointer",
                    marginLeft: "10px"
                }}
                onClick={importImage}
            />
            {/* <Button
                icon="export"
                minimal
                onClick={() => {
                    onBeforeChange();
                    Object.assign(target, { [property]: null });
                    setPath(undefined);
                    onChanged();
                }}
            /> */}
            <Button
                icon="cross"
                minimal
                onClick={() => {
                    onBeforeChange();
                    Object.assign(target, { [property]: null });
                    setPath(undefined);
                    onChanged();
                }}
            />            
        </div>
    }
}

