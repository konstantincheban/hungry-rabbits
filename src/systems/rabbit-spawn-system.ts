import type { Container } from 'pixi.js';
import { createRabbitTarget, setRabbitPosition, type RabbitTarget } from '../entities/rabbit';
import type { RabbitType, Vector2 } from '../types/game';

interface RabbitSpawnSystemOptions {
  rabbitRadius: number;
  goldenChance: number;
  respawnDelayMs: number;
  slotCount?: number;
}

interface RabbitSlotRuntime {
  id: number;
  position: Vector2;
  preferredType?: RabbitType;
  allowedTypes: RabbitType[];
  rabbit: RabbitTarget | null;
  respawnRemainingMs: number;
}

export interface RabbitSpawnPlanEntry {
  position: Vector2;
  preferredType?: RabbitType;
  allowedTypes?: RabbitType[];
}

const DEFAULT_SLOT_COUNT = 6;

export class RabbitSpawnSystem {
  private readonly slots: RabbitSlotRuntime[];
  private readonly slotCount: number;
  private readonly spawnPlan: RabbitSpawnPlanEntry[] = [];

  private nextRabbitId = 1;
  private arenaWidth = 0;
  private groundY = 0;

  public constructor(
    private readonly layer: Container,
    private readonly options: RabbitSpawnSystemOptions,
  ) {
    this.slotCount = Math.max(1, Math.floor(options.slotCount ?? DEFAULT_SLOT_COUNT));
    this.slots = Array.from({ length: this.slotCount }, (_, index) => ({
      id: index,
      position: { x: 0, y: 0 },
      preferredType: undefined,
      allowedTypes: ['normal', 'golden'],
      rabbit: null,
      respawnRemainingMs: 0,
    }));
  }

  public resize(width: number, groundY: number): void {
    this.arenaWidth = width;
    this.groundY = groundY;

    if (this.spawnPlan.length === 0) {
      this.setSpawnPoints(this.buildFallbackSpawnPoints());
    }

    this.repositionActiveRabbits();
  }

  public setSpawnPoints(points: Vector2[]): void {
    this.setSpawnPlan(points.map((point) => ({
      position: point,
      allowedTypes: ['normal', 'golden'],
    })));
  }

  public setSpawnPlan(plan: RabbitSpawnPlanEntry[]): void {
    this.spawnPlan.length = 0;

    for (const entry of plan) {
      this.spawnPlan.push({
        position: { x: entry.position.x, y: entry.position.y },
        preferredType: entry.preferredType,
        allowedTypes: sanitizeAllowedTypes(entry.allowedTypes),
      });
    }

    if (this.spawnPlan.length === 0) {
      const fallback = this.buildFallbackSpawnPoints().map((point) => ({
        position: point,
        allowedTypes: ['normal', 'golden'] as RabbitType[],
      }));
      this.spawnPlan.push(...fallback);
    }

    this.repositionActiveRabbits();
  }

  public fillInitialSlots(): void {
    for (const slot of this.slots) {
      if (!slot.rabbit) {
        this.spawnRabbit(slot);
      }
    }
  }

  public getActiveRabbits(): RabbitTarget[] {
    const rabbits: RabbitTarget[] = [];

    for (const slot of this.slots) {
      if (slot.rabbit) {
        rabbits.push(slot.rabbit);
      }
    }

    return rabbits;
  }

  public handleHit(rabbitId: number): RabbitTarget | null {
    const slot = this.slots.find((entry) => entry.rabbit?.id === rabbitId);
    if (!slot || !slot.rabbit) {
      return null;
    }

    const rabbit = slot.rabbit;
    rabbit.active = false;

    this.layer.removeChild(rabbit.container);
    rabbit.container.destroy({ children: true });

    slot.rabbit = null;
    slot.respawnRemainingMs = this.options.respawnDelayMs;

    return rabbit;
  }

  public update(deltaMs: number): void {
    for (const slot of this.slots) {
      if (slot.rabbit) {
        continue;
      }

      slot.respawnRemainingMs -= deltaMs;
      if (slot.respawnRemainingMs <= 0) {
        this.spawnRabbit(slot);
      }
    }
  }

  public destroy(): void {
    for (const slot of this.slots) {
      if (!slot.rabbit) {
        continue;
      }

      this.layer.removeChild(slot.rabbit.container);
      slot.rabbit.container.destroy({ children: true });
      slot.rabbit = null;
    }
  }

  private spawnRabbit(slot: RabbitSlotRuntime): void {
    const spawnEntry = this.pickSpawnEntryForRespawn(slot);
    slot.position = {
      x: spawnEntry.position.x,
      y: spawnEntry.position.y,
    };
    slot.preferredType = spawnEntry.preferredType;
    slot.allowedTypes = sanitizeAllowedTypes(spawnEntry.allowedTypes);
    const type = this.pickRabbitType(slot);

    const rabbit = createRabbitTarget({
      id: this.nextRabbitId,
      slotId: slot.id,
      type,
      position: slot.position,
      radius: this.options.rabbitRadius,
    });

    this.nextRabbitId += 1;
    slot.rabbit = rabbit;
    slot.respawnRemainingMs = 0;

    this.layer.addChild(rabbit.container);
  }

  private pickSpawnEntryForRespawn(slot: RabbitSlotRuntime): RabbitSpawnPlanEntry {
    const points = this.getSpawnCandidates();
    if (points.length === 0) {
      return this.buildDefaultSpawnEntry();
    }

    const occupiedSlotsByPoint = this.getOccupiedSlotsByPoint(slot.id);
    const freePoints = points.filter((point) => !occupiedSlotsByPoint.has(this.toPointKey(point.position)));

    // When only one point is free (e.g. same amount of points as alive rabbits),
    // swap with a random live rabbit so the respawn doesn't stick to one location.
    if (freePoints.length === 1 && occupiedSlotsByPoint.size > 0) {
      const freePoint = freePoints[0] as RabbitSpawnPlanEntry;
      const occupiedPoints = points.filter((point) => occupiedSlotsByPoint.has(this.toPointKey(point.position)));

      if (occupiedPoints.length > 0) {
        const targetPoint = occupiedPoints[Math.floor(Math.random() * occupiedPoints.length)] as RabbitSpawnPlanEntry;
        const displacedSlot = occupiedSlotsByPoint.get(this.toPointKey(targetPoint.position));

        if (displacedSlot) {
          displacedSlot.position = {
            x: freePoint.position.x,
            y: freePoint.position.y,
          };
          displacedSlot.preferredType = freePoint.preferredType;
          displacedSlot.allowedTypes = sanitizeAllowedTypes(freePoint.allowedTypes);

          if (displacedSlot.rabbit) {
            setRabbitPosition(displacedSlot.rabbit, displacedSlot.position);
          }
        }

        return {
          position: {
            x: targetPoint.position.x,
            y: targetPoint.position.y,
          },
          preferredType: targetPoint.preferredType,
          allowedTypes: sanitizeAllowedTypes(targetPoint.allowedTypes),
        };
      }
    }

    return this.pickSpawnEntry(slot.id);
  }

  private repositionActiveRabbits(): void {
    for (const slot of this.slots) {
      if (!slot.rabbit) {
        continue;
      }

      const spawnEntry = this.pickSpawnEntry(slot.id);
      slot.position = {
        x: spawnEntry.position.x,
        y: spawnEntry.position.y,
      };
      slot.preferredType = spawnEntry.preferredType;
      slot.allowedTypes = sanitizeAllowedTypes(spawnEntry.allowedTypes);
      setRabbitPosition(slot.rabbit, slot.position);
    }
  }

  private pickSpawnEntry(slotId: number): RabbitSpawnPlanEntry {
    const points = this.getSpawnCandidates();

    if (points.length === 0) {
      return this.buildDefaultSpawnEntry();
    }

    const occupied = this.getOccupiedPointKeys(slotId);

    const shuffled = [...points];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j] as RabbitSpawnPlanEntry, shuffled[i] as RabbitSpawnPlanEntry];
    }

    for (const point of shuffled) {
      if (!occupied.has(this.toPointKey(point.position))) {
        return {
          position: { ...point.position },
          preferredType: point.preferredType,
          allowedTypes: sanitizeAllowedTypes(point.allowedTypes),
        };
      }
    }

    const fallback = shuffled[0] as RabbitSpawnPlanEntry;
    return {
      position: { ...fallback.position },
      preferredType: fallback.preferredType,
      allowedTypes: sanitizeAllowedTypes(fallback.allowedTypes),
    };
  }

  private getSpawnCandidates(): RabbitSpawnPlanEntry[] {
    if (this.spawnPlan.length > 0) {
      return this.spawnPlan;
    }

    return this.buildFallbackSpawnPoints().map((point) => ({
      position: point,
      allowedTypes: ['normal', 'golden'] as RabbitType[],
    }));
  }

  private buildDefaultSpawnEntry(): RabbitSpawnPlanEntry {
    return {
      position: {
        x: this.arenaWidth * 0.7,
        y: this.groundY - 120,
      },
      allowedTypes: ['normal', 'golden'],
    };
  }

  private getOccupiedPointKeys(ignoreSlotId: number): Set<string> {
    return new Set(this.getOccupiedSlotsByPoint(ignoreSlotId).keys());
  }

  private getOccupiedSlotsByPoint(ignoreSlotId: number): Map<string, RabbitSlotRuntime> {
    const occupied = new Map<string, RabbitSlotRuntime>();

    for (const slot of this.slots) {
      if (slot.id === ignoreSlotId || !slot.rabbit) {
        continue;
      }

      occupied.set(this.toPointKey(slot.position), slot);
    }
    return occupied;
  }

  private toPointKey(point: Vector2): string {
    return `${Math.round(point.x)}:${Math.round(point.y)}`;
  }

  private buildFallbackSpawnPoints(): Vector2[] {
    if (this.arenaWidth <= 0 || this.groundY <= 0) {
      return [];
    }

    return [
      { x: this.arenaWidth * 0.52, y: this.groundY - 106 },
      { x: this.arenaWidth * 0.65, y: this.groundY - 92 },
      { x: this.arenaWidth * 0.79, y: this.groundY - 118 },
      { x: this.arenaWidth * 0.58, y: this.groundY - 182 },
      { x: this.arenaWidth * 0.73, y: this.groundY - 176 },
      { x: this.arenaWidth * 0.86, y: this.groundY - 198 },
      { x: this.arenaWidth * 0.9, y: this.groundY - 142 },
    ];
  }

  private pickRabbitType(slot: RabbitSlotRuntime): RabbitType {
    const allowed = sanitizeAllowedTypes(slot.allowedTypes);
    const allowsGolden = allowed.includes('golden');
    const allowsNormal = allowed.includes('normal');

    if (slot.preferredType === 'golden' && allowsGolden && Math.random() < 0.82) {
      return 'golden';
    }

    if (!allowsGolden && allowsNormal) {
      return 'normal';
    }

    if (!allowsNormal && allowsGolden) {
      return 'golden';
    }

    if (Math.random() < this.options.goldenChance) {
      return 'golden';
    }

    return 'normal';
  }
}

function sanitizeAllowedTypes(types?: RabbitType[]): RabbitType[] {
  if (!types || types.length === 0) {
    return ['normal', 'golden'];
  }

  const set = new Set<RabbitType>();
  for (const type of types) {
    if (type === 'normal' || type === 'golden') {
      set.add(type);
    }
  }

  if (set.size === 0) {
    return ['normal'];
  }

  return [...set];
}
