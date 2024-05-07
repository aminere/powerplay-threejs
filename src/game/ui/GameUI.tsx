import { useEffect, useState } from "react";
import { UIType } from "../GameDefinitions";
import { cmdHideUI, cmdShowUI } from "../../Events";
import { IGameUIProps } from "./GameUIProps";
import { GameMapUI } from "./GameMapUI";
import { DebugUI } from "./DebugUI";
import "./GameUI.css";

export function GameUI(props: IGameUIProps) {
    const [ui, setUI] = useState<UIType>();

    useEffect(() => {
        const onShowUI = (_ui: UIType) => {
            setUI(_ui);
        };
        const onHideUI = (_ui: UIType) => {
            if (ui === _ui) {
                setUI(undefined);
            }
        };
        cmdShowUI.attach(onShowUI);
        cmdHideUI.attach(onHideUI);
        return () => {
            cmdShowUI.detach(onShowUI);
            cmdHideUI.detach(onHideUI);
        };
    }, [ui]);

    return <>
        {(() => {
            switch (ui) {
                case "gamemap":
                    return <>
                        <GameMapUI {...props} />
                        <DebugUI />
                    </>;
            }
        })()}
    </>
}

