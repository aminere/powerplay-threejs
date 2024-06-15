import { cmdExitGame, cmdShowUI } from "../../Events";
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
        backgroundSize: "cover",
        textShadow: "1px 1px 0px black",
        textTransform: "uppercase"
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
                height: "14rem"
            }}>
                <span style={{
                    fontFamily: "protector",
                    fontSize: "12rem",
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
                cmdShowUI.post(null);
                engine.loadScene("/scenes/tutorial.json");
            }}>
                Learn to Play
            </MenuButton>
            <MenuButton
                // disabled={!gameState.tutorialCompleted}
                onClick={() => {
                    cmdShowUI.post(null);
                    engine.loadScene("/scenes/sandbox.json");
                }}>
                Sandbox
            </MenuButton>
            <MenuButton
                disabled={true}
                onClick={() => {
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
                cmdExitGame.post();
            }}>
                Exit
            </MenuButton>
        </div>

        <div style={{
            display: "flex",
            flexDirection: "column",
            position: "absolute",
            left: "1rem",
            bottom: "1rem",
            gap: ".5rem",
            fontSize: "2rem",
        }}>
            <span>DEMO</span>
            <img
                style={{
                    maxWidth: "10ch"
                }}
                src="/images/powerplayrts.com.png"
            />
            <a
                href="https://powerplayrts.com"
                target="_blank"
                style={{
                    color: "#fbe184",
                }}
            >
                powerplayrts.com
            </a>
        </div>

    </div>
}

