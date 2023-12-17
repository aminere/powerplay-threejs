import { useEffect, useRef } from "react"
import { cmdEndSelection, cmdStartSelection, cmdUpdateUI } from "../../Events";
import { Vector2 } from "three";
import { input } from "../../engine/Input";

export function SelectionRect() {

    const rect = useRef<HTMLDivElement>(null);
    const selectionStart = useRef<Vector2>(new Vector2());

    useEffect(() => {
        const updateUI = () => {
            if (input.touchJustMoved) {
                const startX = Math.min(input.touchPos.x, selectionStart.current.x);
                const startY = Math.min(input.touchPos.y, selectionStart.current.y);
                const width = Math.abs(input.touchPos.x - selectionStart.current.x);
                const height = Math.abs(input.touchPos.y - selectionStart.current.y);
                rect.current!.style.left = `${startX}px`;
                rect.current!.style.top = `${startY}px`;
                rect.current!.style.width = `${width}px`;
                rect.current!.style.height = `${height}px`;
            }
        };

        const onStartElection = (pos: Vector2) => {            
            rect.current!.style.left = `${pos.x}px`;
            rect.current!.style.top = `${pos.y}px`;
            rect.current!.style.width = "0px";
            rect.current!.style.height = "0px";
            rect.current!.style.display = "block";
            selectionStart.current.copy(pos);
        };

        const onEndSelection = () => {
            rect.current!.style.display = "none";
        }

        cmdStartSelection.attach(onStartElection);
        cmdEndSelection.attach(onEndSelection);
        cmdUpdateUI.attach(updateUI);
        return () => {            
            cmdStartSelection.detach(onStartElection);
            cmdEndSelection.detach(onEndSelection);
            cmdUpdateUI.detach(updateUI);
        }
    }, []);

    return <div
        ref={rect}
        style={{
            position: "absolute",
            border: "1px solid #7ac987",
            display: "none"
        }}
    />
}

