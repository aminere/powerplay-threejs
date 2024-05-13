import { useEffect, useRef, useState } from "react";

interface IconProps {
    name: string;
}

const loadErrors: Record<string, boolean> = {};

export function Icon(props: IconProps) {
    const loading = useRef(true);
    const [icon, setIcon] = useState(props.name);
    const [loaded, setLoaded] = useState<boolean | null>(null);

    const onError = () => {
        loading.current = false;
        setLoaded(false);
    };

    const { name } = props;
    useEffect(() => {        
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
                loading.current = false;
                setLoaded(true);
            };
            loading.current = true;
            setLoaded(false);
            img.src = `/images/icons/${name}.png`;
        }   
        setIcon(name);
    }, [name]);

    if (loading.current || name !== icon) {
        return null;
    }

    if (loaded) {
        return <img src={`/images/icons/${icon}.png`} />
    }

    return <span>{icon}</span>;
}

