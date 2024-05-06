import { useEffect, useRef, useState } from "react";
import { evtActionCleared } from "../../Events";
import { ActionButton } from "./ActionButton";
import { uiconfig } from "./uiconfig";
import { GameMapState } from "../components/GameMapState";
import gsap from "gsap";

interface IActionSectionProps {
    open: boolean;
    name: string;
    actions: readonly string[];
    onSelected: (action: string) => void;
    onOpen: () => void;
    onClose: () => void;
}

export function ActionSection(props: IActionSectionProps) {
    const [open, setOpen] = useState(props.open);
    const [action, setAction] = useState<string | null>(null);
    const actionsRef = useRef<HTMLDivElement>(null);

    const { open: _open } = props;
    useEffect(() => {
        setOpen(_open);
    }, [_open])

    useEffect(() => {
        if (open) {
            actionsRef.current!.style.display = "flex";
            // gsap.to(actionsRef.current, {
            //     scaleY: 1,
            //     opacity: 1,
            //     duration: 0.2,
            //     onComplete: () => {
            //         actionsRef.current!.style.pointerEvents = "all";
            //     }
            // });
        } else {
            setAction(null);
            actionsRef.current!.style.display = "none";
            // gsap.to(actionsRef.current, {
            //     scaleY: 0,
            //     opacity: 0,
            //     duration: 0.2,
            //     onComplete: () => {
            //         actionsRef.current!.style.pointerEvents = "none";
            //     }
            // });
        }
    }, [open]);

    useEffect(() => {
        const onActionCleared = () => {
            setAction(null);
        };
        evtActionCleared.attach(onActionCleared);
        return () => {
            evtActionCleared.detach(onActionCleared);
        }
    }, []);

    return <ActionButton
        onClick={() => {
            if (open) {
                setOpen(false);
                props.onClose();
            } else {
                setOpen(true);
                props.onOpen();
            }
        }}
    >
        <span>{props.name}</span>
        <div
            ref={actionsRef}
            style={{
                position: "absolute",
                left: `calc(${uiconfig.buttonSize}rem + ${uiconfig.gap}rem)`,                
                flexDirection: "column",
                gap: `${uiconfig.gap}rem`,
                display: "none", //"flex",
                // transform: "scaleY(0)",
                // opacity: 0,
                // pointerEvents: "none"
            }}
        >
            {props.actions.map(_action => {
                return <ActionButton
                    key={_action}
                    selected={action === _action}
                    selectedColor="yellow"
                    onClick={() => {
                        const gameMapState = GameMapState.instance;
                        if (action === _action) {
                            setAction(null);
                            gameMapState.action = null;
                            return;
                        }
                        setAction(_action);
                        props.onSelected(_action);
                    }}
                >
                    {_action}
                </ActionButton>
            })}
        </div>
    </ActionButton>
}

