import backgroundImageUrl from "./background_secondary.png";
import dirtImageUrl from "./dirt.png";
import groundImageUrl from "./ground.png";
import goldenRabbitImageUrl from "./golden_rabbit.png";
import rabbitImageUrl from "./rabbit.png";
import turretImageUrl from "./turret.png";

export const ASSET_KEYS = {
	BACKGROUND: "background-image",
	DIRT: "dirt-image",
	GROUND: "ground-image",
	GOLDEN_RABBIT: "golden-rabbit-image",
	RABBIT: "rabbit-image",
	TURRET: "turret-image",
} as const;

export const ASSET_BUNDLES = {
	CORE: "core",
} as const;

export const ASSET_MANIFEST = {
	bundles: [
		{
			name: ASSET_BUNDLES.CORE,
			assets: [
				{ alias: ASSET_KEYS.BACKGROUND, src: backgroundImageUrl },
				{ alias: ASSET_KEYS.DIRT, src: dirtImageUrl },
				{ alias: ASSET_KEYS.GROUND, src: groundImageUrl },
				{ alias: ASSET_KEYS.GOLDEN_RABBIT, src: goldenRabbitImageUrl },
				{ alias: ASSET_KEYS.RABBIT, src: rabbitImageUrl },
				{ alias: ASSET_KEYS.TURRET, src: turretImageUrl },
			],
		},
	],
};
