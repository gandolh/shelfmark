import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// The one stylesheet: Tailwind, the tokens and the page's defaults.
import "./styles/index.css";

import { App } from "./App";
import { armFeedback } from "./scanner/feedback";

const root = document.getElementById("root");
if (root === null) throw new Error("index.html has no #root");

// iOS only lets Web Audio start inside a user gesture. Listening from the first
// load means the tap that opens the scanner already unlocks the beep.
armFeedback();

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
