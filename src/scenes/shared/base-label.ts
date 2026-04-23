import { Text, TextStyle } from 'pixi.js';

export function createTitleLabel(text: string): Text {
  const title = new Text({
    text,
    style: new TextStyle({
      fill: 0xfff7cc,
      fontFamily: 'Trebuchet MS, Arial, sans-serif',
      fontSize: 42,
      fontWeight: '800',
      align: 'center',
      stroke: { color: 0x0b1220, width: 7, join: 'round' },
      dropShadow: {
        alpha: 0.75,
        angle: Math.PI / 2,
        blur: 3,
        color: 0x000000,
        distance: 2,
      },
    }),
  });

  title.anchor.set(0.5);
  return title;
}

export function createBodyLabel(text: string, fontSize = 24): Text {
  const body = new Text({
    text,
    style: new TextStyle({
      fill: 0xf8fafc,
      fontFamily: 'Trebuchet MS, Arial, sans-serif',
      fontSize,
      fontWeight: '500',
      align: 'center',
      stroke: { color: 0x111827, width: 4, join: 'round' },
      dropShadow: {
        alpha: 0.65,
        angle: Math.PI / 2,
        blur: 2,
        color: 0x000000,
        distance: 1,
      },
    }),
  });

  body.anchor.set(0.5);
  return body;
}
