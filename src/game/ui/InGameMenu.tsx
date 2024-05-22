import { useEffect, useRef } from "react";
import { ISceneInfo, engine } from "../../engine/Engine";
import { utils } from "../../engine/Utils";
import { TextButton } from "./TextButton";
import { uiconfig } from "./uiconfig";
import { cmdOpenInGameMenu, cmdShowUI, evtSceneCreated } from "../../Events";
import gsap from "gsap";
import { gameState } from "../GameState";

export function InGameMenu() {

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

    useEffect(() => {
        const onSceneCreated = (info: ISceneInfo) => {
            console.log(`Scene created: ${info.name}`);
            console.assert(info.name === "mainmenu");
            cmdShowUI.post("mainmenu");
        };
        evtSceneCreated.attach(onSceneCreated);
        return () => {
            evtSceneCreated.detach(onSceneCreated);
        }
    }, []);

    return <div
        className="ui"
        style={{
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
                fontFamily: "protector",
                fontSize: "4rem",
                color: "#fbe184",
                filter: "drop-shadow(2px 4px 6px black)",
                padding: "1rem"
            }}>
                POWERPLAY
            </div>
            <TextButton text={"Continue"} onClick={() => {
                cmdOpenInGameMenu.post(false);
                gameState.inGameMenuOpen = false;
            }} />
            <TextButton text={"Quit"} onClick={() => {
                engine.parseScene(utils.createNewScene("mainmenu").toJSON());
            }} />
        </div>
    </div>
}

