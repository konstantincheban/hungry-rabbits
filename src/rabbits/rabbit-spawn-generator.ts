import type { GeneratedLevel } from '../level/level-types';
import { buildRabbitSpawnSlots } from './rabbit-slot-builder';
import { DEFAULT_PROJECTILE_SIMULATION_CONFIG } from './projectile-simulator';
import {
  DEFAULT_RABBIT_SET_VALIDATOR_CONFIG,
  validateRabbitSet,
  type RabbitSetValidatorConfig,
} from './rabbit-spawn-validator';
import type {
  GeneratedRabbitSet,
  ProjectileSimulationConfig,
  RabbitSlotBuilderConfig,
  RabbitSpawnContext,
  RabbitSpawnGeneratorConfig,
  RabbitSpawnSlot,
  SpawnedRabbit,
  TurretState,
} from './rabbit-types';

export const DEFAULT_RABBIT_SPAWN_GENERATOR_CONFIG: RabbitSpawnGeneratorConfig = {
  targetRabbitCount: 6,
  maxAttempts: 20,
  goldenMaxCount: 1,
  minHorizontalSpreadPx: 165,
  maxBandShare: 0.5,
  maxGroundShare: 0.12,
  easyTargetMinPerSet: 1,
  debug: false,
};

interface GenerateRabbitSetOptions {
  generatorConfig?: Partial<RabbitSpawnGeneratorConfig>;
  slotBuilderConfig?: Partial<RabbitSlotBuilderConfig>;
  validatorConfig?: Partial<RabbitSetValidatorConfig>;
  simulationConfig?: Partial<ProjectileSimulationConfig>;
  random?: () => number;
}

export function generateRabbitSet(
  level: GeneratedLevel,
  turretState: TurretState,
  context: RabbitSpawnContext,
  options: GenerateRabbitSetOptions = {},
): GeneratedRabbitSet {
  const generatorConfig = {
    ...DEFAULT_RABBIT_SPAWN_GENERATOR_CONFIG,
    ...options.generatorConfig,
  };
  const validatorConfig = {
    ...DEFAULT_RABBIT_SET_VALIDATOR_CONFIG,
    ...options.validatorConfig,
    minHorizontalSpreadPx: options.validatorConfig?.minHorizontalSpreadPx ?? generatorConfig.minHorizontalSpreadPx,
    maxGoldenCount: options.validatorConfig?.maxGoldenCount ?? generatorConfig.goldenMaxCount,
    requireEasyTarget: options.validatorConfig?.requireEasyTarget ?? (generatorConfig.easyTargetMinPerSet > 0),
  };
  const simulationConfig = {
    ...DEFAULT_PROJECTILE_SIMULATION_CONFIG,
    ...options.simulationConfig,
  };

  const rng = options.random ?? Math.random;
  const debugLogs: string[] = [];
  const slots = buildRabbitSpawnSlots(level, turretState, context, options.slotBuilderConfig);
  const targetCount = Math.max(1, Math.min(generatorConfig.targetRabbitCount, slots.length));

  let bestAttempt: {
    rabbits: SpawnedRabbit[];
    slots: RabbitSpawnSlot[];
    validation: ReturnType<typeof validateRabbitSet>;
    attempt: number;
  } | null = null;

  if (slots.length === 0) {
    return {
      rabbits: [],
      slots: [],
      attempts: 1,
      validation: {
        valid: false,
        reasons: ['Немає валідних слотів для спавну кроликів.'],
        reachableSolutions: {},
      },
      debugLogs: generatorConfig.debug ? ['[rabbits] no slots from builder'] : undefined,
    };
  }

  for (let attempt = 1; attempt <= generatorConfig.maxAttempts; attempt += 1) {
    const selectedSlots = selectSpawnSlots(slots, targetCount, generatorConfig, rng);
    const rabbits = materializeRabbits(selectedSlots, context.rabbitRadius);
    assignRabbitTypes(rabbits, selectedSlots, generatorConfig.goldenMaxCount, rng);

    const validation = validateRabbitSet(
      level,
      turretState,
      rabbits,
      context,
      simulationConfig,
      validatorConfig,
    );

    if (generatorConfig.debug) {
      const logLine = `[rabbits] attempt ${attempt}/${generatorConfig.maxAttempts} slots=${selectedSlots.length} valid=${validation.valid}`;
      debugLogs.push(logLine);
      if (!validation.valid) {
        debugLogs.push(`  reasons: ${validation.reasons.join(' | ')}`);
      }
    }

    if (!bestAttempt || validation.reasons.length < bestAttempt.validation.reasons.length) {
      bestAttempt = {
        rabbits,
        slots: selectedSlots,
        validation,
        attempt,
      };
    }

    if (validation.valid) {
      return {
        rabbits,
        slots: selectedSlots,
        validation,
        attempts: attempt,
        debugLogs: generatorConfig.debug ? debugLogs : undefined,
      };
    }
  }

  if (!bestAttempt) {
    throw new Error('Rabbit spawn generation failed unexpectedly.');
  }

  return {
    rabbits: bestAttempt.rabbits,
    slots: bestAttempt.slots,
    validation: bestAttempt.validation,
    attempts: bestAttempt.attempt,
    debugLogs: generatorConfig.debug ? debugLogs : undefined,
  };
}

function selectSpawnSlots(
  slots: RabbitSpawnSlot[],
  targetCount: number,
  config: RabbitSpawnGeneratorConfig,
  rng: () => number,
): RabbitSpawnSlot[] {
  const selected: RabbitSpawnSlot[] = [];
  const selectedIds = new Set<string>();
  const nonGroundPool = shuffle([...slots.filter((slot) => !isGroundSlot(slot))], rng);
  const groundPool = shuffle([...slots.filter((slot) => isGroundSlot(slot))], rng);
  const maxPerBand = Math.max(1, Math.ceil(targetCount * config.maxBandShare));
  const maxGroundCount = Math.max(0, Math.floor(targetCount * config.maxGroundShare));
  const byBandCount = new Map<string, number>();
  let groundCount = 0;

  const pickFromPool = (
    pool: RabbitSpawnSlot[],
    options: { ignoreBandCap?: boolean; ignoreGroundCap?: boolean; allowTightSpacing?: boolean } = {},
  ): void => {
    while (selected.length < targetCount && pool.length > 0) {
      const weighted = pool.map((slot) => ({
        item: slot,
        weight: slotWeight(slot, selected, config.minHorizontalSpreadPx, rng),
      }));
      const picked = pickWeighted(weighted, rng);
      if (!picked) {
        break;
      }

      removeSlotFromList(pool, picked.id);

      if (selectedIds.has(picked.id)) {
        continue;
      }

      const bandKey = picked.heightBand;
      const bandCount = byBandCount.get(bandKey) ?? 0;
      if (!options.ignoreBandCap && bandCount >= maxPerBand) {
        continue;
      }

      if (!options.ignoreGroundCap && isGroundSlot(picked) && groundCount >= maxGroundCount) {
        continue;
      }

      const tooClose = selected.some((existing) => (
        Math.abs(existing.worldX - picked.worldX) < (config.minHorizontalSpreadPx * 0.42)
        && Math.abs(existing.worldY - picked.worldY) < 84
      ));
      if (!options.allowTightSpacing && tooClose) {
        continue;
      }

      selected.push(picked);
      selectedIds.add(picked.id);
      if (isGroundSlot(picked)) {
        groundCount += 1;
      }
      byBandCount.set(bandKey, bandCount + 1);
    }
  };

  // Keep ground rare by filling elevated slots first.
  pickFromPool(nonGroundPool);
  pickFromPool(groundPool);

  // Fallback: relax constraints only to satisfy target count.
  if (selected.length < targetCount) {
    const leftovers = shuffle([...nonGroundPool, ...groundPool], rng);
    pickFromPool(leftovers, {
      ignoreBandCap: true,
      ignoreGroundCap: true,
      allowTightSpacing: true,
    });
  }

  // Final safety fill in randomized order.
  if (selected.length < targetCount) {
    const remaining = shuffle(
      slots.filter((slot) => !selectedIds.has(slot.id)),
      rng,
    );
    for (const slot of remaining) {
      if (selected.length >= targetCount) {
        break;
      }

      selected.push(slot);
      selectedIds.add(slot.id);
    }
  }

  return shuffle(selected.slice(0, targetCount), rng);
}

function materializeRabbits(slots: RabbitSpawnSlot[], rabbitRadius: number): SpawnedRabbit[] {
  const width = rabbitRadius * 2;
  const height = rabbitRadius * 2.8;

  return slots.map((slot, index) => ({
    id: `rabbit-${index + 1}`,
    type: 'normal',
    slotId: slot.id,
    worldX: slot.worldX,
    worldY: slot.worldY,
    width,
    height,
    difficultyScore: slot.difficultyScore,
  }));
}

function assignRabbitTypes(
  rabbits: SpawnedRabbit[],
  slots: RabbitSpawnSlot[],
  maxGoldenCount: number,
  rng: () => number,
): void {
  for (const rabbit of rabbits) {
    rabbit.type = 'normal';
  }

  const slotById = new Map<string, RabbitSpawnSlot>();
  for (const slot of slots) {
    slotById.set(slot.id, slot);
  }

  const goldenCandidates = rabbits.filter((rabbit) => {
    const slot = slotById.get(rabbit.slotId);
    return slot?.allowedTypes.includes('golden') ?? false;
  });

  if (goldenCandidates.length === 0 || maxGoldenCount <= 0) {
    return;
  }

  const wantsGolden = rng() < 0.72;
  if (!wantsGolden) {
    return;
  }

  const goldenCount = Math.min(maxGoldenCount, 1, goldenCandidates.length);
  for (let index = 0; index < goldenCount; index += 1) {
    const weighted = goldenCandidates.map((rabbit) => {
      const slot = slotById.get(rabbit.slotId);
      const score = slot?.difficultyScore ?? 0.5;
      return {
        item: rabbit,
        weight: Math.max(0.1, (score * 1.5) + 0.2),
      };
    });

    const picked = pickWeighted(weighted, rng);
    if (!picked) {
      break;
    }

    picked.type = 'golden';
    removeRabbitFromList(goldenCandidates, picked.id);
  }
}

function slotWeight(
  slot: RabbitSpawnSlot,
  selected: RabbitSpawnSlot[],
  minHorizontalSpreadPx: number,
  rng: () => number,
): number {
  let spreadBonus = 1;
  for (const existing of selected) {
    const horizontalDistance = Math.abs(existing.worldX - slot.worldX);
    if (horizontalDistance < minHorizontalSpreadPx) {
      spreadBonus *= 0.5;
    }
  }

  const difficultyWeight = 0.8 + (slot.difficultyScore * 0.9);
  const goldenReadyBonus = slot.allowedTypes.includes('golden') ? 0.15 : 0;
  const groundPenalty = isGroundSlot(slot) ? 0.45 : 1;
  const randomJitter = 0.82 + (rng() * 0.42);
  return Math.max(0.05, (difficultyWeight * spreadBonus + goldenReadyBonus) * groundPenalty * randomJitter);
}

function pickWeighted<T>(entries: Array<{ item: T; weight: number }>, rng: () => number): T | null {
  if (entries.length === 0) {
    return null;
  }

  const total = entries.reduce((sum, entry) => sum + Math.max(0.001, entry.weight), 0);
  let cursor = rng() * total;

  for (const entry of entries) {
    cursor -= Math.max(0.001, entry.weight);
    if (cursor <= 0) {
      return entry.item;
    }
  }

  return entries[entries.length - 1]?.item ?? null;
}

function removeSlotFromList(slots: RabbitSpawnSlot[], slotId: string): void {
  const index = slots.findIndex((slot) => slot.id === slotId);
  if (index >= 0) {
    slots.splice(index, 1);
  }
}

function removeRabbitFromList(rabbits: SpawnedRabbit[], rabbitId: string): void {
  const index = rabbits.findIndex((rabbit) => rabbit.id === rabbitId);
  if (index >= 0) {
    rabbits.splice(index, 1);
  }
}

function isGroundSlot(slot: RabbitSpawnSlot): boolean {
  return slot.sourceModuleKind === 'ground-strip';
}

function shuffle<T>(list: T[], rng: () => number): T[] {
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex] as T, list[index] as T];
  }

  return list;
}
