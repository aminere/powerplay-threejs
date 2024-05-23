import { useEffect, useRef } from "react";
import { ISceneInfo, engine } from "../../engine/Engine";
import { utils } from "../../engine/Utils";
import { TextButton } from "./TextButton";
import { uiconfig } from "./uiconfig";
import { cmdOpenInGameMenu, cmdShowUI, evtSceneCreated } from "../../Events";
import { GameMapState } from "../components/GameMapState";

export function InGameMenu() {

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

    const dialogRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        setTimeout(() => {
            dialogRef.current!.classList.add("visible");
        }, 10);
        engine.paused = true;
        GameMapState.instance.inGameMenuOpen = true;
        return () => {
            engine.paused = false;
            if (!GameMapState.instance) {
                return;
            }
            GameMapState.instance.inGameMenuOpen = false;
            setTimeout(() => {
                GameMapState.instance.cursorOverUI = false;
            }, 60);
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
            className="dialog"
            style={{
                backgroundColor: uiconfig.backgroundColor,
                padding: `${uiconfig.paddingRem}rem`,
                gap: `${uiconfig.paddingRem * 2}rem`,
                display: "flex",
                flexDirection: "column",
                maxWidth: "80ch"
            }}
        >
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
            }} />
            <TextButton text={"Quit"} onClick={() => {
                engine.parseScene(utils.createNewScene("mainmenu").toJSON());
            }} />
        </div>
    </div>
}

