import { TextButton } from "powerplay-lib"

interface IProps {
    onPlay: () => void;
}

export function Intro(props: IProps) {

    return <div
        className="overlay"
        style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "1rem"            
        }}
    >
        <div
            style={{
                fontSize: "8rem",
            }}
        >
            POWER PLAY
        </div>
        <TextButton text={"PLAY"} onClick={props.onPlay} />
    </div>
}

