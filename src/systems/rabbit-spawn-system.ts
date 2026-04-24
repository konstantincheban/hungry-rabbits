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
  lastPointKey: string | null;
  lastHitPointKey: string | null;
  preferredType?: RabbitType;
  allowedTypes: RabbitType[];
  isGround: boolean;
  rabbit: RabbitTarget | null;
  respawnRemainingMs: number;
}

export interface RabbitSpawnPlanEntry {
  position: Vector2;
  preferredType?: RabbitType;
  allowedTypes?: RabbitType[];
  isGround?: boolean;
}

const DEFAULT_SLOT_COUNT = 6;

export class RabbitSpawnSystem {
  private readonly slots: RabbitSlotRuntime[];
  private readonly slotCount: number;
  private readonly spawnPlan: RabbitSpawnPlanEntry[] = [];

  private nextRabbitId = 1;
  private arenaWidth = 0;
  private groundY = 0;
  private rabbitRadius: number;

  public constructor(
    private readonly layer: Container,
    private readonly options: RabbitSpawnSystemOptions,
  ) {
    this.rabbitRadius = Math.max(10, options.rabbitRadius);
    this.slotCount = Math.max(1, Math.floor(options.slotCount ?? DEFAULT_SLOT_COUNT));
    this.slots = Array.from({ length: this.slotCount }, (_, index) => ({
      id: index,
      position: { x: 0, y: 0 },
      lastPointKey: null,
      lastHitPointKey: null,
      preferredType: undefined,
      allowedTypes: ['normal', 'golden'],
      isGround: false,
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

  public setRabbitRadius(radius: number): void {
    const nextRadius = Math.max(10, radius);
    if (Math.abs(nextRadius - this.rabbitRadius) < 0.25) {
      return;
    }

    this.rabbitRadius = nextRadius;
    this.rebuildActiveRabbitsForRadius();
  }

  public setSpawnPoints(points: Vector2[]): void {
    this.setSpawnPlan(points.map((point) => ({
      position: point,
      allowedTypes: ['normal', 'golden'],
      isGround: this.isGroundPoint(point),
    })));
  }

  public setSpawnPlan(plan: RabbitSpawnPlanEntry[]): void {
    this.spawnPlan.length = 0;

    for (const entry of plan) {
      this.spawnPlan.push({
        position: { x: entry.position.x, y: entry.position.y },
        preferredType: entry.preferredType,
        allowedTypes: sanitizeAllowedTypes(entry.allowedTypes),
        isGround: entry.isGround ?? this.isGroundPoint(entry.position),
      });
    }

    if (this.spawnPlan.length === 0) {
      const fallback = this.buildFallbackSpawnPoints().map((point) => ({
        position: point,
        allowedTypes: ['normal', 'golden'] as RabbitType[],
        isGround: this.isGroundPoint(point),
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

    slot.lastHitPointKey = this.toPointKey(slot.position);
    slot.rabbit = null;
    slot.isGround = false;
    slot.respawnRemainingMs = this.options.respawnDelayMs;

    return rabbit;
  }

  public update(deltaMs: number): void {
    for (const slot of this.slots) {
      if (slot.rabbit) {
        continue;
      }

      if (slot.respawnRemainingMs > 0) {
        slot.respawnRemainingMs -= deltaMs;
      }

      if (slot.respawnRemainingMs <= 0 && !this.spawnRabbit(slot)) {
        // Keep retrying every update while constraints are unsatisfied.
        slot.respawnRemainingMs = 0;
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

  private spawnRabbit(slot: RabbitSlotRuntime): boolean {
    const spawnEntry = this.pickSpawnEntry(slot);
    if (!spawnEntry) {
      return false;
    }

    slot.position = {
      x: spawnEntry.position.x,
      y: spawnEntry.position.y,
    };
    slot.lastPointKey = this.toPointKey(slot.position);
    slot.lastHitPointKey = null;
    slot.preferredType = spawnEntry.preferredType;
    slot.allowedTypes = sanitizeAllowedTypes(spawnEntry.allowedTypes);
    slot.isGround = this.isGroundEntry(spawnEntry);
    const type = this.pickRabbitType(slot);

    const rabbit = createRabbitTarget({
      id: this.nextRabbitId,
      slotId: slot.id,
      type,
      position: slot.position,
      radius: this.rabbitRadius,
    });

    this.nextRabbitId += 1;
    slot.rabbit = rabbit;
    slot.respawnRemainingMs = 0;

    this.layer.addChild(rabbit.container);
    return true;
  }

  private pickSpawnEntry(slot: RabbitSlotRuntime): RabbitSpawnPlanEntry | null {
    const points = this.getSpawnCandidates();
    if (points.length === 0) {
      const defaultEntry = this.buildDefaultSpawnEntry();
      return this.isHardAllowedForSlot(defaultEntry, slot) ? defaultEntry : null;
    }

    const avoidPointKeys = new Set<string>();
    if (slot.lastPointKey) {
      avoidPointKeys.add(slot.lastPointKey);
    }

    const currentPointKey = this.toPointKey(slot.position);
    if (currentPointKey !== '0:0') {
      avoidPointKeys.add(currentPointKey);
    }

    const shuffled = this.shuffleSpawnEntries(points);
    const hardAllowed = shuffled.filter((entry) => this.isHardAllowedForSlot(entry, slot));

    if (hardAllowed.length === 0) {
      return null;
    }

    const recentHitAvoided = hardAllowed.filter((entry) => !this.isPointBlockedByRecentHit(this.toPointKey(entry.position)));
    const freshnessPool = recentHitAvoided.length > 0 ? recentHitAvoided : hardAllowed;
    const preferred = freshnessPool.filter((entry) => !avoidPointKeys.has(this.toPointKey(entry.position)));
    const pool = preferred.length > 0 ? preferred : freshnessPool;
    const picked = pool[Math.floor(Math.random() * pool.length)] as RabbitSpawnPlanEntry;
    return this.cloneSpawnEntry(picked);
  }

  private repositionActiveRabbits(): void {
    for (const slot of this.slots) {
      if (!slot.rabbit) {
        continue;
      }

      const spawnEntry = this.pickSpawnEntry(slot);
      if (!spawnEntry) {
        continue;
      }

      slot.position = {
        x: spawnEntry.position.x,
        y: spawnEntry.position.y,
      };
      slot.preferredType = spawnEntry.preferredType;
      slot.allowedTypes = sanitizeAllowedTypes(spawnEntry.allowedTypes);
      slot.isGround = this.isGroundEntry(spawnEntry);
      setRabbitPosition(slot.rabbit, slot.position);
    }
  }

  private getSpawnCandidates(): RabbitSpawnPlanEntry[] {
    if (this.spawnPlan.length > 0) {
      return this.spawnPlan;
    }

    return this.buildFallbackSpawnPoints().map((point) => ({
      position: point,
      allowedTypes: ['normal', 'golden'] as RabbitType[],
      isGround: this.isGroundPoint(point),
    }));
  }

  private buildDefaultSpawnEntry(): RabbitSpawnPlanEntry {
    return {
      position: {
        x: this.arenaWidth * 0.7,
        y: this.groundY - 120,
      },
      allowedTypes: ['normal', 'golden'],
      isGround: false,
    };
  }

  private getOccupiedPointKeys(ignoreSlotId: number): Set<string> {
    const occupied = new Set<string>();

    for (const slot of this.slots) {
      if (slot.id === ignoreSlotId || !slot.rabbit) {
        continue;
      }

      occupied.add(this.toPointKey(slot.position));
    }

    return occupied;
  }

  private hasActiveGroundRabbit(ignoreSlotId: number): boolean {
    for (const slot of this.slots) {
      if (slot.id === ignoreSlotId || !slot.rabbit) {
        continue;
      }

      if (slot.isGround) {
        return true;
      }
    }

    return false;
  }

  private isHardAllowedForSlot(entry: RabbitSpawnPlanEntry, slot: RabbitSlotRuntime): boolean {
    const key = this.toPointKey(entry.position);
    if (this.getOccupiedPointKeys(slot.id).has(key)) {
      return false;
    }

    if (slot.lastHitPointKey && key === slot.lastHitPointKey) {
      return false;
    }

    if (this.isGroundEntry(entry) && this.hasActiveGroundRabbit(slot.id)) {
      return false;
    }

    return true;
  }

  private isPointBlockedByRecentHit(pointKey: string): boolean {
    for (const slot of this.slots) {
      if (slot.lastHitPointKey === pointKey) {
        return true;
      }
    }

    return false;
  }

  private toPointKey(point: Vector2): string {
    return `${Math.round(point.x)}:${Math.round(point.y)}`;
  }

  private cloneSpawnEntry(entry: RabbitSpawnPlanEntry): RabbitSpawnPlanEntry {
    return {
      position: { ...entry.position },
      preferredType: entry.preferredType,
      allowedTypes: sanitizeAllowedTypes(entry.allowedTypes),
      isGround: this.isGroundEntry(entry),
    };
  }

  private shuffleSpawnEntries(entries: RabbitSpawnPlanEntry[]): RabbitSpawnPlanEntry[] {
    const shuffled = [...entries];

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j] as RabbitSpawnPlanEntry, shuffled[i] as RabbitSpawnPlanEntry];
    }

    return shuffled;
  }

  private isGroundEntry(entry: RabbitSpawnPlanEntry): boolean {
    return entry.isGround ?? this.isGroundPoint(entry.position);
  }

  private isGroundPoint(point: Vector2): boolean {
    if (this.groundY <= 0) {
      return false;
    }

    const groundLineY = this.groundY - this.rabbitRadius - 2;
    const tolerance = Math.max(2, this.rabbitRadius * 0.15);
    return Math.abs(point.y - groundLineY) <= tolerance;
  }

  private buildFallbackSpawnPoints(): Vector2[] {
    if (this.arenaWidth <= 0 || this.groundY <= 0) {
      return [];
    }

    const sizeScale = this.rabbitRadius / 24;

    return [
      { x: this.arenaWidth * 0.52, y: this.groundY - (106 * sizeScale) },
      { x: this.arenaWidth * 0.65, y: this.groundY - (92 * sizeScale) },
      { x: this.arenaWidth * 0.79, y: this.groundY - (118 * sizeScale) },
      { x: this.arenaWidth * 0.58, y: this.groundY - (182 * sizeScale) },
      { x: this.arenaWidth * 0.73, y: this.groundY - (176 * sizeScale) },
      { x: this.arenaWidth * 0.86, y: this.groundY - (198 * sizeScale) },
      { x: this.arenaWidth * 0.9, y: this.groundY - (142 * sizeScale) },
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

  private rebuildActiveRabbitsForRadius(): void {
    for (const slot of this.slots) {
      if (!slot.rabbit) {
        continue;
      }

      const previous = slot.rabbit;
      this.layer.removeChild(previous.container);
      previous.container.destroy({ children: true });

      const rebuilt = createRabbitTarget({
        id: previous.id,
        slotId: slot.id,
        type: previous.type,
        position: slot.position,
        radius: this.rabbitRadius,
      });

      slot.rabbit = rebuilt;
      this.layer.addChild(rebuilt.container);
    }
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
