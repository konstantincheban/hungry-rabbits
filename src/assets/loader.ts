import { Assets } from 'pixi.js';
import { ASSET_BUNDLES, ASSET_MANIFEST } from './manifest';

let initialized = false;

export async function preloadAssets(): Promise<void> {
  if (initialized) {
    return;
  }

  await Assets.init({ manifest: ASSET_MANIFEST });
  await Assets.loadBundle(ASSET_BUNDLES.CORE);
  initialized = true;
}
