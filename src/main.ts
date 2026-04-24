import "./style.css";

import backgroundImageUrl from "./assets/background.png";
import { bootstrap } from "./app/bootstrap";

document.documentElement.style.setProperty(
	"--app-background-image",
	`url("${backgroundImageUrl}")`,
);

void bootstrap();
