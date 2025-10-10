import React, { Suspense, lazy } from 'react';

import { Intro } from './ui/Intro';
import { LoadingIndicator } from './core/LoadingIndicator';
import { Transition } from './Transition';
import { Env } from './env';
import { Fonts } from './core/Fonts';

const Game = lazy(() => import('./Game'));

interface IProps {
  onMounted: () => void;
}

interface IState {
  intro: boolean;
  mounted: boolean;
  loaded: boolean;
}

// to avoid importing three here
class Vector2 {
  x = 0;
  y = 0;
}

export class App extends React.Component<IProps, IState> {

  private _transition!: Transition;
  private _pointerPos = new Vector2();

  constructor(props: IProps) {
    super(props);
    this.state = {
      intro: true,
      mounted: false,
      loaded: false,
    };
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onRightClick = this.onRightClick.bind(this);
  }

  componentDidMount() {
    this.setState({ mounted: true });
  }  

  componentDidUpdate(prevProps: Readonly<IProps>, prevState: Readonly<IState>, snapshot?: any): void {
    if (prevState.mounted === false && this.state.mounted === true) {

      const preload = async () => {
        await Fonts.preload();
      }

      preload()
        .then(() => {
          window.addEventListener("contextmenu", this.onRightClick);
          window.addEventListener("pointermove", this.onPointerMove);      
          this.setState({ loaded: true });
          this._transition.fadeIn();
          this.props.onMounted();
        })
        // auto play TODO remove
        .then(() => this.onPlay())
    }
  }

  componentWillUnmount() {
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("contextmenu", this.onRightClick);
  }

  public render() {
    const { loaded, intro } = this.state;
    return <div style={{
      height: "100%",
      backgroundColor: "black"
    }}>
      {
        intro
        &&
        <Intro
          onPlay={() => {
            if (this._transition.active) {
              return;
            }
            this.onPlay();
          }}
        />
      }
      {
        !intro
        &&
        <Suspense fallback={<LoadingIndicator />}>
          <Game pointerPos={this._pointerPos} /> 
        </Suspense>
      }
      <Transition ref={e => this._transition = e as Transition} />
      {!loaded && <LoadingIndicator />}      
    </div>
  }

  private onPlay() {    
    if (Env.isWeb) {
      (document.body as any).requestPointerLock({ unadjustedMovement: false });
    }
    this._transition.transition(() => {
      this.setState({ intro: false });
    });
  }

  private onPointerMove(e: PointerEvent) {
    const isPointerLocked = Boolean(document.pointerLockElement);
    if (!isPointerLocked) {
      this._pointerPos.x = e.clientX;
      this._pointerPos.y = e.clientY;
    } else {
      this._pointerPos.x += e.movementX;
      this._pointerPos.y += e.movementY;
      this._pointerPos.x = Math.max(0, Math.min(this._pointerPos.x, document.body.clientWidth));
      this._pointerPos.y = Math.max(0, Math.min(this._pointerPos.y, document.body.clientHeight));
    }
  }

  private onRightClick(e: MouseEvent) {
    e.preventDefault();
  }
}

