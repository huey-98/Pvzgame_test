import { createRoot } from "react-dom/client";
import "../../styles/main.css";
import "./styles.css";
import "./game/engine.js";
import App from "./app/App.jsx";

createRoot(document.getElementById("root")).render(<App />);
