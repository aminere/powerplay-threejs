import { useEffect, useRef } from "react";
import { TextButton } from "./TextButton";
import { uiconfig } from "./uiconfig";

import gsap from "gsap";
import { engine } from "../../engine/Engine";
import { AmbientLight, MathUtils, PerspectiveCamera, Scene } from "three";
import { cmdShowUI, evtSceneCreated } from "../../Events";

function createNewScene() {
    const scene = new Scene();
    const camera = new PerspectiveCamera();
    camera.position.set(4, 3, 4);
    camera.rotation.set(MathUtils.degToRad(-30), MathUtils.degToRad(45), 0, 'YXZ');
    camera.userData.eulerRotation = camera.rotation.clone();
    scene.add(camera);
    const ambient = new AmbientLight(0xffffff, .2);
    scene.add(ambient);
    scene.updateWorldMatrix(true, true);
    return scene;
}

export function TutorialComplete() {
    const dialogRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!dialogRef.current) {
            return;
        }
        gsap.to(dialogRef.current, {
            scaleY: 1,
            opacity: 1,
            duration: .3,                
        });
    }, []);

    return <div style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        left: "0px",
        top: "0px",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
    }}>
        <div
            ref={dialogRef}
            style={{
                backgroundColor: uiconfig.backgroundColor,
                padding: `${uiconfig.paddingRem}rem`,
                gap: `${uiconfig.paddingRem * 2}rem`,
                display: "flex",
                flexDirection: "column",
                maxWidth: "80ch",
                transform: "scaleY(0)",
                opacity: 0
            }}>
            <div style={{
                fontSize: "2rem",
                color: "yellow"
            }}>
                Mission Complete!
            </div>
            <div style={{
                fontSize: "1.2rem"
            }}>
                Congratulations on completing the tutorial. <br />
                You are now ready to play on your own terms. <br />
                Good luck!
            </div>
            <div>
                <TextButton text={"Continue"} onClick={() => {                    
                    engine.parseScene(createNewScene().toJSON(), info => {
                        evtSceneCreated.post(info);
                        cmdShowUI.post("mainmenu");
                    });
                }} />
            </div>
        </div>
    </div>
}

