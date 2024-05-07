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
            gsap.to(actionsRef.current, {
                scaleY: 1,
                opacity: 1,
                duration: 0.2                
            });
        } else {
            setAction(null);
            gsap.to(actionsRef.current, {
                scaleY: 0,
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    actionsRef.current!.style.display = "none";
                }
            });
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
        selected={open}
        selectedColor="white"
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
        <img src={`/images/icons/${props.name}.png`} />        
        <div
            ref={actionsRef}
            style={{
                position: "absolute",
                padding: `${uiconfig.paddingRem}rem`,
                backgroundColor: `${uiconfig.backgroundColor}`,
                left: `calc(${uiconfig.buttonSizeRem}rem + ${uiconfig.paddingRem}rem - ${uiconfig.selectedBorderSizePx}px)`,
                flexDirection: "column",
                gap: `${uiconfig.gapRem}rem`,
                display: "none", //"flex",
                transform: "scaleY(0)",
                opacity: 0,
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
                    <img src={`/images/icons/${_action}.png`} />
                </ActionButton>
            })}
        </div>
    </ActionButton>
}

