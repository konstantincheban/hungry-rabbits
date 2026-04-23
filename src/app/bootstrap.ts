import { GameApp } from './game-app';

export async function bootstrap(): Promise<void> {
  const mountNode = document.getElementById('app');

  if (!mountNode) {
    throw new Error('Missing #app mount node.');
  }

  const gameApp = new GameApp(mountNode);
  await gameApp.init();
}
