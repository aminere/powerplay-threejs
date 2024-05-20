import React, { useEffect, useRef, useState } from "react";
import { uiconfig } from "./uiconfig";
import { GridFiller } from "./GridFiller";
import gsap from "gsap";

interface OutputPanelProps {
    open: boolean;
}

export function OutputPanel(props: React.PropsWithChildren<OutputPanelProps>) {
    const [_open, setOpen] = useState(props.open);
    const rootRef = useRef<HTMLDivElement | null>(null);

    const { open } = props;
    useEffect(() => {
        setOpen(open);
    }, [open]);

    useEffect(() => {
        if (!rootRef.current) {
            return;
        }
        if (_open) {
            rootRef.current!.style.display = "grid";
            gsap.to(rootRef.current, {
                scaleY: 1,
                opacity: 1,
                duration: 0.2
            });
        } else {
            gsap.to(rootRef.current, {
                scaleY: 0,
                opacity: 0,
                duration: 0.2,
                onComplete: () => {
                    if (!rootRef.current) {
                        return;
                    }
                    rootRef.current!.style.display = "none";
                }
            });
        }
    }, [_open]);

    const height = `${uiconfig.outputRows} * ${uiconfig.buttonSizeRem}rem + ${uiconfig.outputRows - 1} * ${uiconfig.gapRem}rem + 2 * ${uiconfig.paddingRem}rem`;
    return <div
        className="ui"
        ref={rootRef}
        style={{
            position: "absolute",
            left: "0px",
            top: `calc(-1 * (${height}))`,
            height: `calc(${height})`,
            overflowY: "auto",
            overflowX: "hidden",
            backgroundColor: uiconfig.backgroundColor,
            padding: `${uiconfig.paddingRem}rem`,
            transformOrigin: "bottom",
            transform: "scaleY(0)",
            opacity: 0,
            display: "none"
        }}
        onWheel={e => e.stopPropagation()}
    >
        <div
            style={{
                position: "relative",
                height: "100%",
                display: "grid",
                gap: `${uiconfig.gapRem}rem`,
                gridTemplateColumns: `repeat(${uiconfig.outputColumns}, ${uiconfig.buttonSizeRem}rem)`,
                gridAutoRows: "min-content",
            }}
        >
            <GridFiller slots={uiconfig.outputColumns * uiconfig.outputRows} columns={uiconfig.outputColumns} />
            {props.children}
        </div>
    </div>
}

