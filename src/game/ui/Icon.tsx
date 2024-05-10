import { useEffect, useRef } from "react";

interface IconProps {
    name: string;
}

const loadErrors: Record<string, boolean> = {};

export function Icon(props: IconProps) {
    const { name } = props;
    const rootRef = useRef<HTMLDivElement | null>(null);
    useEffect(() => {
        if (!rootRef.current) {
            return;
        }
        if (rootRef.current.firstChild) {
            rootRef.current!.removeChild(rootRef.current.firstChild);
        }

        const onError = () => {
            const desc = document.createElement("span");
            desc.innerText = name;
            rootRef.current!.appendChild(desc);
        };

        const error = loadErrors[name];
        if (error) {
            onError();
        } else {
            const img = document.createElement("img");
            img.onerror = () => {
                loadErrors[name] = true;
                onError();
            };
            img.onload = () => {
                rootRef.current!.appendChild(img);
            };
            img.src = `/images/icons/${name}.png`;
        }

    }, [name]);

    return <div ref={rootRef} />
}

