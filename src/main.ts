import "./style.css";

import backgroundImageUrl from "./assets/background.png";
import { GAME_CONFIG } from "./app/config";
import { bootstrap } from "./app/bootstrap";

document.documentElement.style.setProperty(
	"--app-background-image",
	`url("${backgroundImageUrl}")`,
);
document.documentElement.style.setProperty(
	"--app-min-width",
	`${GAME_CONFIG.minGameWidth}px`,
);

void bootstrap();
