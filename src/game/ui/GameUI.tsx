import { useEffect, useState } from "react";
import { UIType } from "../GameDefinitions";
import { cmdShowUI } from "../../Events";
import { IGameUIProps } from "./GameUIProps";
import { GameMapUI } from "./GameMapUI";
import { MainMenu } from "./MainMenu";
import { engine } from "../../engine/Engine";
import { utils } from "../../engine/Utils";
import { GameMapState } from "../components/GameMapState";
import "./GameUI.css";

export function GameUI(props: IGameUIProps) {
    const [ui, setUI] = useState<UIType | null>(null);

    useEffect(() => {
        const onShowUI = (_ui: UIType | null) => {
            setUI(_ui);
        };        
        cmdShowUI.attach(onShowUI);
        return () => {
            cmdShowUI.detach(onShowUI);
        };
    }, []);

    useEffect(() => {
        if (engine.runtime === "editor") {
            return;
        }

        const onClick = () => {
            if (!utils.isPointerLocked()) {
                return;
            }
            const { rawPointerPos } = props;
            const actions = document.querySelectorAll(".action");
            for (const action of actions) {
                const rect = action.getBoundingClientRect();
                if (rawPointerPos.x >= rect.left && rawPointerPos.x <= rect.right && rawPointerPos.y >= rect.top && rawPointerPos.y <= rect.bottom) {
                    (action as HTMLElement).click();
                }
            }
        };

        const onGamePointerMove = () => {
            if (!utils.isPointerLocked()) {
                return;
            }
            let cursorOverUI = false;
            const { rawPointerPos } = props;
            const uis = document.querySelectorAll(".ui");
            for (const ui of uis) {
                const rect = ui.getBoundingClientRect();
                if (rawPointerPos.x >= rect.left && rawPointerPos.x <= rect.right && rawPointerPos.y >= rect.top && rawPointerPos.y <= rect.bottom) {
                    cursorOverUI = true;
                    break;
                }
            }
            if (GameMapState.instance) {
                GameMapState.instance.cursorOverUI = cursorOverUI;
            }
        };

        document.addEventListener('pointermove', onGamePointerMove);
        document.addEventListener('click', onClick);
        return () => {
            document.removeEventListener('pointermove', onGamePointerMove);
            document.removeEventListener('click', onClick);
        }
    }, []);

    switch (ui) {
        case "gamemap": return <GameMapUI {...props} />;
        case "mainmenu": return <MainMenu />;
    }

    return null;
}

