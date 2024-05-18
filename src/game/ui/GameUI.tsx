import { useEffect, useState } from "react";
import { UIType } from "../GameDefinitions";
import { cmdShowUI } from "../../Events";
import { IGameUIProps } from "./GameUIProps";
import { GameMapUI } from "./GameMapUI";
import "./GameUI.css";

export function GameUI(props: IGameUIProps) {
    const [ui, setUI] = useState<UIType | null>(null);

    useEffect(() => {
        const onShowUI = (_ui: UIType | null) => setUI(_ui);        
        cmdShowUI.attach(onShowUI);
        return () => {
            cmdShowUI.detach(onShowUI);
        };
    }, [ui]);

    switch (ui) {
        case "gamemap": return <GameMapUI {...props} />;
    }

    return null;
}

