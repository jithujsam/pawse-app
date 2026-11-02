import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource-variable/geist";
import "./styles.css";
import { wire } from "./interactions";

/** The page reads in full from its HTML. This only adds the small behaviours: reveals, parallax, the journey scrubber and the forms. */
document.documentElement.classList.add("js");
wire();
