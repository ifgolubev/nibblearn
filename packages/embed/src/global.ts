import "@nibblearn/react/styles.css";
import { defineNibblearnElement, hydrate, mountElement, unmountElement } from "./index";

// Standalone build: register <nibblearn-module> as soon as the script runs.
defineNibblearnElement();

export { defineNibblearnElement, hydrate, mountElement, unmountElement };
