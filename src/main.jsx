import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import YamaGame from "./YamaGame.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <YamaGame />
  </StrictMode>
);
