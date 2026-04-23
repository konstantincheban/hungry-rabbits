import type { LevelZone, ModuleTemplate } from './module-types';

export const MODULE_LIBRARY: ModuleTemplate[] = [
  {
    id: 'ground-base',
    kind: 'ground-strip',
    widthRange: [24, 40],
    heightRange: [3, 5],
    allowedZones: ['left-safe', 'center-low', 'right-low'],
    canHostRabbits: true,
    difficultyWeight: 1,
  },
  {
    id: 'low-platform-short',
    kind: 'low-platform',
    widthRange: [4, 5],
    heightRange: [2, 2],
    allowedZones: ['center-low', 'right-low'],
    canHostRabbits: true,
    difficultyWeight: 1,
    generationConstraints: {
      requiresSupport: true,
      minSpacingCols: 1,
      minRow: 15,
      maxRow: 19,
    },
  },
  {
    id: 'low-platform-wide',
    kind: 'low-platform',
    widthRange: [6, 8],
    heightRange: [2, 3],
    allowedZones: ['center-low', 'right-low'],
    canHostRabbits: true,
    difficultyWeight: 1.2,
    generationConstraints: {
      requiresSupport: true,
      minSpacingCols: 1,
      minRow: 14,
      maxRow: 19,
    },
  },
  {
    id: 'medium-platform-flat',
    kind: 'medium-platform',
    widthRange: [4, 7],
    heightRange: [2, 3],
    allowedZones: ['center-mid', 'right-mid'],
    canHostRabbits: true,
    difficultyWeight: 1.5,
    generationConstraints: {
      minSpacingCols: 1,
      minRow: 10,
      maxRow: 16,
    },
  },
  {
    id: 'medium-platform-chunky',
    kind: 'medium-platform',
    widthRange: [3, 5],
    heightRange: [3, 4],
    allowedZones: ['center-mid', 'right-mid'],
    canHostRabbits: true,
    difficultyWeight: 1.65,
    generationConstraints: {
      minSpacingCols: 1,
      minRow: 9,
      maxRow: 15,
    },
  },
  {
    id: 'floating-ledge-small',
    kind: 'floating-platform',
    widthRange: [3, 4],
    heightRange: [1, 2],
    allowedZones: ['center-mid', 'right-mid', 'upper-right'],
    canHostRabbits: true,
    difficultyWeight: 1.7,
    generationConstraints: {
      minSpacingCols: 1,
      minRow: 5,
      maxRow: 12,
    },
  },
  {
    id: 'floating-ledge-wide',
    kind: 'floating-platform',
    widthRange: [4, 6],
    heightRange: [1, 2],
    allowedZones: ['right-mid', 'upper-right'],
    canHostRabbits: true,
    difficultyWeight: 1.9,
    generationConstraints: {
      minSpacingCols: 1,
      minRow: 4,
      maxRow: 10,
    },
  },
  {
    id: 'tall-column-narrow',
    kind: 'tall-column',
    widthRange: [1, 2],
    heightRange: [5, 7],
    allowedZones: ['center-low', 'right-low', 'right-mid'],
    canHostRabbits: false,
    difficultyWeight: 1.6,
    generationConstraints: {
      requiresSupport: true,
      minSpacingCols: 2,
      minRow: 12,
      maxRow: 19,
    },
  },
  {
    id: 'tall-column-thick',
    kind: 'tall-column',
    widthRange: [2, 2],
    heightRange: [6, 8],
    allowedZones: ['right-low', 'right-mid'],
    canHostRabbits: false,
    difficultyWeight: 1.85,
    generationConstraints: {
      requiresSupport: true,
      minSpacingCols: 2,
      minRow: 11,
      maxRow: 19,
    },
  },
  {
    id: 'cover-section-step',
    kind: 'cover-section',
    widthRange: [3, 5],
    heightRange: [3, 4],
    allowedZones: ['center-low', 'right-low'],
    canHostRabbits: true,
    difficultyWeight: 1.45,
    generationConstraints: {
      requiresSupport: true,
      minSpacingCols: 1,
      minRow: 14,
      maxRow: 19,
    },
  },
];

export function getGroundStripTemplate(): ModuleTemplate {
  const template = MODULE_LIBRARY.find((entry) => entry.kind === 'ground-strip');
  if (!template) {
    throw new Error('ground-strip template is missing');
  }

  return template;
}

export function getZoneTemplates(zone: LevelZone): ModuleTemplate[] {
  return MODULE_LIBRARY.filter((template) => (
    template.kind !== 'ground-strip'
    && template.allowedZones.includes(zone)
  ));
}
