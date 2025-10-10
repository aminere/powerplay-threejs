
// import { BrowserRouter, Route, Routes } from "react-router-dom";
// import { GoHome } from "./utils/GoHome";
// import { useState } from "react";
// import { GoTo } from "./utils/GoTo";
import { Editor } from "./Editor";

function App() {

  // const [route, setRoute] = useState<string>();
  
  return <>
    <Editor />
    {/* <BrowserRouter>
      <Routes>
        <Route path="/" element={<Editor />} />
        <Route path="/*" element={<GoHome onFinished={() => setRoute(undefined)} />} />
      </Routes>
      <GoTo route={route} onFinished={() => setRoute(undefined)} />
    </BrowserRouter> */}
  </>
}

export default App

