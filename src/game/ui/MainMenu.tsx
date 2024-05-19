import { cmdShowUI, evtSceneCreated } from "../../Events";
import { engine } from "../../engine/Engine";
import { MenuButton } from "./MenuButton";

export function MainMenu() {
    return <div style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: "100%",
        height: "100%",
        backgroundImage: "url(/images/mainmenu-bg.png)",
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover"
    }}>
        <div style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: "1rem",
            height: "100%",
            maxWidth: "40ch",
            margin: "0 auto",
            // transform: "translateY(-5rem)",
        }}>
            <div style={{
                position: "relative",
                height: "12rem"
            }}>
                <span style={{
                    fontFamily: "protector",
                    fontSize: "8rem",
                    color: "#fbe184",
                    filter: "drop-shadow(2px 4px 6px black)",
                    position: "absolute",
                    transform: "translateX(-50%)",
                    left: "50%",
                }}>
                    POWERPLAY
                </span>
            </div>
            <MenuButton onClick={() => {

            }}>
                Learn to Play
            </MenuButton>
            <MenuButton
                disabled={true}
                onClick={() => {
                    cmdShowUI.post(null);
                    // engine.parseScene(createNewScene().toJSON(), info => {
                    //     evtSceneCreated.post(info);
                    // });
                }}
            >
                New Game
            </MenuButton>
            {/* <MenuButton onClick={() => {

            }}>
                Wishlist on<br />
                <img src={"/images/steam.png"} />
            </MenuButton> */}
            <div style={{
                height: "4rem"
            }} />
            <MenuButton onClick={() => {

            }}>
                Exit
            </MenuButton>
        </div>
    </div>
}

