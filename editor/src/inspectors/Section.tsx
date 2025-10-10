import { Button, Collapse, IconName } from "@blueprintjs/core";
import { useState } from "react";

interface IProps {
    name: string;
    actions?: Array<{
        icon: IconName;
        onClick: (e: HTMLElement) => void;
    }>;
}

export function Section(props: React.PropsWithChildren<IProps>) {
    const [open, setOpen] = useState((localStorage.getItem(`section-${props.name}`) ?? "true") === "true");
    return <>
        <div
            style={{
                display: "flex",
                gap: ".2rem",
                height: "30px",
                alignItems: "center",
                cursor: "pointer",
                boxShadow: "rgba(0, 0, 0, 0.36) 0px 1px 3px 0px",
                background: "#323942",
                textShadow: "black 1px 1px",
                paddingLeft: ".2rem",
                position: "relative"
            }}
            onClick={() => {
                setOpen(!open);
                localStorage.setItem(`section-${props.name}`, (!open).toString());
            }}
        >
            <span className={`bp5-icon-standard bp5-icon-${open ? "chevron-down" : "chevron-right"}`} />
            <span>{props.name}</span>
            {
                props.actions
                &&
                <div style={{ position: "absolute", right: "0px" }}>
                    {props.actions.map((action, i) => <Button
                        key={i}

                        icon={action.icon}
                        minimal
                        onClick={e => {
                            e.stopPropagation();
                            action.onClick(e.currentTarget);
                        }}
                    />)}
                </div>
            }
        </div>
        <Collapse isOpen={open}>
            {props.children}
        </Collapse>
    </>
}

