import { Assets, Container, Graphics, Rectangle, Sprite, Text, TextStyle, Texture } from 'pixi.js';
import { GAMEPLAY_CONFIG } from '../../app/config';
import { SCENES } from '../../app/constants';
import { ASSET_KEYS } from '../../assets/manifest';
import {
  createHitParticles,
  createMissParticles,
  type MissParticle,
  updateMissParticle,
} from '../../entities/particles';
import { createTurretEntity } from '../../entities/turret';
import type { Scene, SceneContext } from '../../core/scene-manager';
import { createRunSummary, createInitialSessionState, setLatestGameRunSummary } from '../../state/game-session';
import { detectProjectileRabbitHits } from '../../systems/collision-system';
import { consumeComboMultiplierOnHit, resetComboOnMiss } from '../../systems/combo-system';
import { ProjectileSystem } from '../../systems/projectile-system';
import { RabbitSpawnSystem } from '../../systems/rabbit-spawn-system';
import { applyHitScore } from '../../systems/scoring-system';
import { ShootingSystem } from '../../systems/shooting-system';
import { AimSystem } from '../../systems/aim-system';
import { audioSystem } from '../../systems/audio-system';
import type { ArenaBounds, RabbitType, RectBounds, Vector2 } from '../../types/game';
import { createTextButton } from '../../ui/button';
import { GameHud } from '../../ui/hud';
import { createBodyLabel } from '../shared/base-label';
import { LEVEL_GENERATION_CONFIG } from '../../level/config';
import { createLevelGrid, gridRectToWorldRect, gridToWorld, type LevelGrid } from '../../level/grid';
import { generateLevel } from '../../level/level-generator';
import type { GeneratedLevel } from '../../level/level-types';
import { generateRabbitSet } from '../../rabbits/rabbit-spawn-generator';
import type { TurretState } from '../../rabbits/rabbit-types';

const DEFAULT_AIM_ANGLE_RAD = 0;
const DEFAULT_AIM_POWER = 0.52;
const REFERENCE_WIDTH = 430;
const MOBILE_UI_SCALE_FACTOR = 0.9;
const FULLSCREEN_ENTER_LABEL = 'Fullscreen';
const FULLSCREEN_EXIT_LABEL = 'Exit fullscreen';
const GAME_SCENE_BODY_CLASS = 'game-scene-active';
const BASE_TILE_SIZE = 24;
const BASE_TURRET_WIDTH = 166;

interface FloatingFeedback {
  label: Text;
  velocity: Vector2;
  ageMs: number;
  lifeMs: number;
}

interface GameViewport {
  worldWidth: number;
  worldHeight: number;
  isMobile: boolean;
  isPortrait: boolean;
}

interface RuntimeScale {
  worldScale: number;
  turretWidth: number;
  rabbitRadius: number;
  projectileRadius: number;
  maxPullDistance: number;
  turretOffsetX: number;
  turretOffsetFromGround: number;
  groundHeight: number;
}

const DEFAULT_RUNTIME_SCALE: RuntimeScale = {
  worldScale: 1,
  turretWidth: BASE_TURRET_WIDTH,
  rabbitRadius: GAMEPLAY_CONFIG.rabbitRadius,
  projectileRadius: GAMEPLAY_CONFIG.projectileRadius,
  maxPullDistance: GAMEPLAY_CONFIG.maxDragDistance,
  turretOffsetX: GAMEPLAY_CONFIG.turretOffsetX,
  turretOffsetFromGround: GAMEPLAY_CONFIG.turretOffsetFromGround,
  groundHeight: GAMEPLAY_CONFIG.groundHeight,
};

export function createGameScene({ sceneController }: SceneContext): Scene {
  const container = new Container();

  const sceneRoot = new Container();
  const worldLayer = new Container();
  const uiLayer = new Container();
  sceneRoot.addChild(worldLayer, uiLayer);
  container.addChild(sceneRoot);

  const backgroundTexture = (Assets.get<Texture>(ASSET_KEYS.BACKGROUND) ?? Texture.WHITE);
  const sceneBackground = Sprite.from(backgroundTexture);
  const dirtTexture = (Assets.get<Texture>(ASSET_KEYS.DIRT) ?? Texture.WHITE);
  const groundTexture = (Assets.get<Texture>(ASSET_KEYS.GROUND) ?? Texture.WHITE);
  const dirtTileLayer = new Container();
  const groundCapLayer = new Container();
  const groundEdge = new Graphics();
  const constructionLayer = new Container();
  const rabbitLayer = new Container();
  const projectileLayer = new Container();
  const particleLayer = new Container();
  const feedbackLayer = new Container();
  const aimGuide = new Graphics();
  const interactionLayer = new Container();

  worldLayer.addChild(
    sceneBackground,
    dirtTileLayer,
    groundCapLayer,
    groundEdge,
    constructionLayer,
    rabbitLayer,
    projectileLayer,
    particleLayer,
    feedbackLayer,
    aimGuide,
    interactionLayer,
  );

  const turret = createTurretEntity({ targetWidthPx: BASE_TURRET_WIDTH });
  worldLayer.addChild(turret.container);

  const hud = new GameHud();
  uiLayer.addChild(hud.container);

  const hint = createBodyLabel('Потягни в протилежний бік та відпусти для пострілу', 18);
  uiLayer.addChild(hint);

  const comboBanner = createBodyLabel('', 30);
  comboBanner.alpha = 0;
  uiLayer.addChild(comboBanner);

  const orientationOverlay = new Container();
  const orientationScrim = new Graphics();
  const orientationGlyph = new Graphics();
  const orientationTitle = createBodyLabel('Поверни пристрій', 30);
  const orientationHint = createBodyLabel('Гра доступна лише в горизонтальному режимі', 20);
  orientationOverlay.visible = false;
  orientationOverlay.eventMode = 'static';
  orientationOverlay.cursor = 'pointer';
  orientationOverlay.addChild(orientationScrim, orientationGlyph, orientationTitle, orientationHint);
  uiLayer.addChild(orientationOverlay);

  const menuButton = createTextButton({
    label: 'Головне меню',
    onPress: () => {
      openMainMenu();
    },
    fontSize: 18,
  });

  const soundEffectsButton = createTextButton({
    label: getSoundEffectsLabel(audioSystem.isEnabled()),
    onPress: () => {
      const enabled = audioSystem.toggleEnabled();
      soundEffectsButton.setLabel(getSoundEffectsLabel(enabled));
    },
    fontSize: 16,
    playClickSound: false,
  });

  const appRoot = document.getElementById('app');
  const canUseFullscreen = !!appRoot && supportsFullscreenMode(appRoot);
  const fullscreenButton = createTextButton({
    label: FULLSCREEN_ENTER_LABEL,
    onPress: () => {
      if (!appRoot) {
        return;
      }

      void toggleFullscreen(appRoot).then(() => {
        syncFullscreenButton();
      });
    },
    fontSize: 16,
  });

  uiLayer.addChild(menuButton, soundEffectsButton, fullscreenButton);

  const session = createInitialSessionState(GAMEPLAY_CONFIG.initialAmmo);

  const shootingSystem = new ShootingSystem(session, {
    minSpeed: GAMEPLAY_CONFIG.minShotSpeed,
    maxSpeed: GAMEPLAY_CONFIG.maxShotSpeed,
  });

  const projectileSystem = new ProjectileSystem(projectileLayer, {
    gravity: GAMEPLAY_CONFIG.gravity,
    projectileRadius: GAMEPLAY_CONFIG.projectileRadius,
  });

  const rabbitSpawnSystem = new RabbitSpawnSystem(rabbitLayer, {
    rabbitRadius: GAMEPLAY_CONFIG.rabbitRadius,
    goldenChance: GAMEPLAY_CONFIG.goldenRabbitChance,
    respawnDelayMs: GAMEPLAY_CONFIG.rabbitRespawnDelayMs,
    slotCount: 6,
  });

  const particles: MissParticle[] = [];
  const floatingFeedbacks: FloatingFeedback[] = [];
  const dirtTiles: Sprite[] = [];
  const groundCapTiles: Sprite[] = [];
  const constructionTiles: Sprite[] = [];

  let arenaBounds: ArenaBounds = {
    width: 0,
    height: 0,
    groundY: 0,
  };

  let roundFinished = false;
  let leavingToMenu = false;
  let comboBannerTimerMs = 0;
  let comboBannerBaseScale = 1;
  let aimPowerRatio = DEFAULT_AIM_POWER;
  let shotSpeedMultiplier = 1;
  let effectiveMaxPullDistance = GAMEPLAY_CONFIG.maxDragDistance;
  let runtimeScale = DEFAULT_RUNTIME_SCALE;
  let constructions: RectBounds[] = [];
  let levelGrid: LevelGrid | null = null;
  let generatedLevel: GeneratedLevel | null = null;
  let lastViewport: GameViewport | null = null;
  let orientationBlocked = false;
  let fullscreenAutoAttempted = false;
  let orientationLockAttempted = false;
  const onFullscreenChange = (): void => {
    syncFullscreenButton();
  };

  const onEscapeKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape') {
      return;
    }

    event.preventDefault();
    openMainMenu();
  };

  const aimSystem = new AimSystem(interactionLayer, {
    minAngleRad: degreesToRadians(GAMEPLAY_CONFIG.minAimAngleDeg),
    maxAngleRad: degreesToRadians(GAMEPLAY_CONFIG.maxAimAngleDeg),
    maxPullDistancePx: GAMEPLAY_CONFIG.maxDragDistance,
    activationRadiusPx: 156,
    minPullDistancePx: 8,
    angleSmoothing: 0.16,
    powerCurveExponent: 0.86,
    getAimOrigin: () => turret.getBasePosition(),
    canShoot: () => !roundFinished && !leavingToMenu && shootingSystem.canShoot(),
    onAimChanged: ({ angleRad, powerRatio, isDragging }) => {
      aimPowerRatio = powerRatio;
      turret.setAimAngle(angleRad);
      drawAimGuide(angleRad, powerRatio, isDragging);
      syncHud();
    },
    onShoot: (angleRad, powerRatio) => {
      audioSystem.unlockFromGesture();

      const shot = shootingSystem.buildShot(
        turret.getMuzzlePosition(),
        angleRad,
        powerRatio,
        shotSpeedMultiplier,
      );

      if (!shot) {
        return;
      }

      audioSystem.play('shot');
      projectileSystem.spawn(shot.position, shot.velocity);
      syncHud();
    },
  });

  aimSystem.setAimState(DEFAULT_AIM_ANGLE_RAD, DEFAULT_AIM_POWER);

  function syncHud(): void {
    hud.update({
      ammo: session.ammo,
      score: session.score,
      combo: session.combo,
      powerRatio: aimPowerRatio,
    });
  }

  function openMainMenu(): void {
    if (leavingToMenu) {
      return;
    }

    leavingToMenu = true;
    void sceneController.changeScene(SCENES.START);
  }

  function syncSoundEffectsLabel(): void {
    soundEffectsButton.setLabel(getSoundEffectsLabel(audioSystem.isEnabled()));
  }

  function syncFullscreenButton(viewport: GameViewport | null = lastViewport): void {
    const shouldShow = !!viewport?.isMobile && canUseFullscreen;
    fullscreenButton.visible = shouldShow;
    fullscreenButton.setEnabled(shouldShow);
    fullscreenButton.setLabel(isFullscreenActive() ? FULLSCREEN_EXIT_LABEL : FULLSCREEN_ENTER_LABEL);
  }

  function tryEnterFullscreenFromGesture(): void {
    if (fullscreenAutoAttempted || !canUseFullscreen || !appRoot) {
      return;
    }

    fullscreenAutoAttempted = true;
    if (!lastViewport?.isMobile || isFullscreenActive()) {
      syncFullscreenButton();
      return;
    }

    void requestFullscreen(appRoot).then(() => {
      syncFullscreenButton();
    });
  }

  function tryLockLandscapeFromGesture(): void {
    if (orientationLockAttempted) {
      return;
    }

    orientationLockAttempted = true;
    if (!lastViewport?.isMobile) {
      return;
    }

    const orientationApi = screen.orientation as ScreenOrientation & {
      lock?: (orientation: 'landscape') => Promise<void>;
    };
    if (!orientationApi || typeof orientationApi.lock !== 'function') {
      return;
    }

    void orientationApi.lock('landscape').catch(() => {
      // Keep overlay fallback when lock is unsupported or blocked by browser policy.
    });
  }

  function onAnyUserGesture(): void {
    audioSystem.unlockFromGesture();
    tryEnterFullscreenFromGesture();
    tryLockLandscapeFromGesture();
  }

  function syncOrientationOverlay(width: number, height: number): void {
    orientationOverlay.visible = orientationBlocked;
    orientationOverlay.hitArea = new Rectangle(0, 0, width, height);
    orientationOverlay.eventMode = orientationBlocked ? 'static' : 'none';
    if (!orientationBlocked) {
      return;
    }

    orientationScrim.clear();
    orientationScrim.rect(0, 0, width, height);
    orientationScrim.fill({ color: 0x020617, alpha: 0.86 });

    const iconSize = clamp(Math.min(width, height) * 0.22, 68, 128);
    drawRotateDeviceGlyph(orientationGlyph, iconSize);
    orientationGlyph.position.set(width * 0.5, height * 0.34);

    const uiScale = clamp(Math.min(width / 560, height / 320), 0.74, 1.2);
    orientationTitle.scale.set(uiScale);
    orientationHint.scale.set(uiScale);

    orientationTitle.x = width * 0.5;
    orientationTitle.y = orientationGlyph.y + (iconSize * 0.64);

    orientationHint.x = width * 0.5;
    orientationHint.y = orientationTitle.y + (46 * uiScale);
  }

  function showComboBanner(text: string, color: number): void {
    comboBanner.text = text;
    comboBanner.tint = color;
    comboBanner.alpha = 1;
    comboBannerTimerMs = 640;
  }

  function spawnFloatingFeedback(
    text: string,
    position: Vector2,
    color: number,
    velocityY = -92,
  ): void {
    const label = new Text({
      text,
      style: new TextStyle({
        fill: color,
        fontFamily: 'Trebuchet MS, Arial, sans-serif',
        fontSize: 22,
        fontWeight: '800',
        align: 'center',
        stroke: { color: 0x0f172a, width: 3, join: 'round' },
      }),
    });

    label.anchor.set(0.5);
    label.position.set(position.x, position.y);
    feedbackLayer.addChild(label);

    floatingFeedbacks.push({
      label,
      velocity: {
        x: -20 + (Math.random() * 40),
        y: velocityY,
      },
      ageMs: 0,
      lifeMs: 650,
    });
  }

  function drawAimGuide(angleRad: number, powerRatio: number, isDragging: boolean): void {
    aimGuide.clear();

    const muzzle = turret.getMuzzlePosition();
    const origin = {
      x: muzzle.x,
      y: muzzle.y - 4,
    };
    const length = 42 + (powerRatio * 214);
    const direction = {
      x: Math.cos(angleRad),
      y: Math.sin(angleRad),
    };
    const segments = Math.max(8, Math.round(10 + (powerRatio * 12)));

    for (let index = 0; index < segments; index += 1) {
      const fromT = index / segments;
      const toT = (index + 1) / segments;

      const startX = origin.x + (direction.x * length * fromT);
      const startY = origin.y + (direction.y * length * fromT);
      const endX = origin.x + (direction.x * length * toT);
      const endY = origin.y + (direction.y * length * toT);
      const segmentColor = mixColors(0xffa726, 0xff3b30, toT);

      aimGuide.moveTo(startX, startY);
      aimGuide.lineTo(endX, endY);
      aimGuide.stroke({
        width: isDragging ? 4.2 : 2.4,
        color: segmentColor,
        alpha: (isDragging ? 0.95 : 0.52) * (0.8 + (toT * 0.2)),
      });
    }

    if (!isDragging) {
      return;
    }

    const endX = origin.x + (direction.x * length);
    const endY = origin.y + (direction.y * length);
    const tipColor = mixColors(0xffa726, 0xff3b30, powerRatio);

    aimGuide.circle(endX, endY, 5);
    aimGuide.fill({ color: tipColor, alpha: 0.95 });
  }

  function redrawArena(): void {
    sceneBackground.position.set(0, 0);
    sceneBackground.width = arenaBounds.width;
    sceneBackground.height = arenaBounds.height;

    const groundHeight = Math.max(0, arenaBounds.height - arenaBounds.groundY);
    const groundCapHeight = clamp(groundHeight * 0.38, 32, 52);
    rebuildGroundTiles(groundHeight, groundCapHeight);

    groundEdge.clear();
    groundEdge.moveTo(0, arenaBounds.groundY);
    groundEdge.lineTo(arenaBounds.width, arenaBounds.groundY);
    groundEdge.stroke({ width: 2, color: 0x64748b, alpha: 0.7 });
  }

  function rebuildGroundTiles(groundHeight: number, groundCapHeight: number): void {
    for (const tile of dirtTiles) {
      dirtTileLayer.removeChild(tile);
      tile.destroy();
    }

    for (const tile of groundCapTiles) {
      groundCapLayer.removeChild(tile);
      tile.destroy();
    }

    dirtTiles.length = 0;
    groundCapTiles.length = 0;

    if (groundHeight <= 0) {
      return;
    }

    const capHeight = clamp(groundCapHeight, 24, groundHeight);
    const dirtHeight = Math.max(0, groundHeight - capHeight);

    if (dirtHeight > 0) {
      buildTileRow({
        layer: dirtTileLayer,
        texture: dirtTexture,
        tileStore: dirtTiles,
        y: arenaBounds.groundY + capHeight,
        rowHeight: dirtHeight,
        minTileWidth: 72,
        maxTileWidth: 168,
      });
    }

    buildTileRow({
      layer: groundCapLayer,
      texture: groundTexture,
      tileStore: groundCapTiles,
      y: arenaBounds.groundY,
      rowHeight: capHeight,
      minTileWidth: 82,
      maxTileWidth: 186,
    });
  }

  function buildTileRow(params: {
    layer: Container;
    texture: Texture;
    tileStore: Sprite[];
    y: number;
    rowHeight: number;
    minTileWidth: number;
    maxTileWidth: number;
  }): void {
    const {
      layer,
      texture,
      tileStore,
      y,
      rowHeight,
      minTileWidth,
      maxTileWidth,
    } = params;

    if (rowHeight <= 0) {
      return;
    }

    const textureWidth = Math.max(1, texture.width);
    const textureHeight = Math.max(1, texture.height);
    const scale = rowHeight / textureHeight;
    const naturalTileWidth = textureWidth * scale;
    const tileWidth = clamp(naturalTileWidth, minTileWidth, maxTileWidth);
    const tileCount = Math.ceil(arenaBounds.width / tileWidth) + 2;

    for (let index = -1; index < tileCount; index += 1) {
      const tile = Sprite.from(texture);
      tile.position.set(index * tileWidth, y);
      tile.width = tileWidth;
      tile.height = rowHeight;

      layer.addChild(tile);
      tileStore.push(tile);
    }
  }

  function redrawConstructions(): void {
    for (const tile of constructionTiles) {
      constructionLayer.removeChild(tile);
      tile.destroy();
    }

    constructionTiles.length = 0;

    if (!generatedLevel || !levelGrid) {
      return;
    }

    const tiles = generatedLevel.tiles
      .filter((tile) => tile.row < levelGrid!.groundTopRow)
      .sort((left, right) => {
        if (left.row !== right.row) {
          return left.row - right.row;
        }

        return left.col - right.col;
      });

    for (const tileData of tiles) {
      const texture = tileData.tile === 'grass-top' ? groundTexture : dirtTexture;
      const worldCell = gridToWorld(tileData, levelGrid);
      const tile = Sprite.from(texture);
      tile.position.set(worldCell.x, worldCell.y);
      tile.width = levelGrid.tileSize;
      tile.height = levelGrid.tileSize;
      tile.roundPixels = true;

      constructionLayer.addChild(tile);
      constructionTiles.push(tile);
    }
  }

  function updateConstructionLayout(width: number, groundY: number, scale: RuntimeScale): void {
    const debugGeneration = import.meta.env.DEV && LEVEL_GENERATION_CONFIG.debugEnabled;

    levelGrid = createLevelGrid({
      arenaWidth: width,
      arenaHeight: arenaBounds.height,
      groundY,
    });

    generatedLevel = generateLevel({
      grid: levelGrid,
      debug: debugGeneration,
      maxAttempts: LEVEL_GENERATION_CONFIG.maxAttempts,
    });

    if (debugGeneration && !generatedLevel.validation.valid) {
      console.warn('[level] using best invalid attempt', generatedLevel.validation.reasons);
    }

    constructions = buildWorldConstructionCollisionRects(generatedLevel, levelGrid);

    redrawConstructions();

    const turretState: TurretState = {
      position: turret.getMuzzlePosition(),
      minAngleRad: degreesToRadians(GAMEPLAY_CONFIG.minAimAngleDeg),
      maxAngleRad: degreesToRadians(GAMEPLAY_CONFIG.maxAimAngleDeg),
    };
    const rabbitSet = generateRabbitSet(generatedLevel, turretState, {
      level: generatedLevel,
      grid: levelGrid,
      arenaWidth: width,
      arenaHeight: arenaBounds.height,
      groundY,
      rabbitRadius: scale.rabbitRadius,
      projectileRadius: scale.projectileRadius,
      gravity: GAMEPLAY_CONFIG.gravity,
      minShotSpeed: GAMEPLAY_CONFIG.minShotSpeed * shotSpeedMultiplier,
      maxShotSpeed: GAMEPLAY_CONFIG.maxShotSpeed * shotSpeedMultiplier,
      collisionRects: constructions,
    }, {
      generatorConfig: {
        targetRabbitCount: 6,
        maxAttempts: 24,
        maxGroundShare: 0.12,
        debug: debugGeneration,
      },
      validatorConfig: {
        debug: debugGeneration,
      },
      simulationConfig: {
        debug: debugGeneration,
      },
    });

    if (debugGeneration) {
      if (!rabbitSet.validation.valid) {
        console.warn('[rabbits] using best invalid attempt', rabbitSet.validation.reasons);
      }

      if (rabbitSet.debugLogs && rabbitSet.debugLogs.length > 0) {
        for (const line of rabbitSet.debugLogs) {
          console.info(line);
        }
      }
    }

    rabbitSpawnSystem.resize(width, groundY);
    if (rabbitSet.slots.length > 0) {
      const preferredTypeBySlotId = new Map<string, RabbitType>();
      for (const rabbit of rabbitSet.rabbits) {
        preferredTypeBySlotId.set(rabbit.slotId, rabbit.type);
      }

      rabbitSpawnSystem.setSpawnPlan(rabbitSet.slots.map((slot) => ({
        position: {
          x: slot.worldX,
          y: slot.worldY,
        },
        preferredType: preferredTypeBySlotId.get(slot.id),
        allowedTypes: slot.allowedTypes,
        isGround: slot.sourceModuleKind === 'ground-strip',
      })));
    } else {
      const fallbackPoints = buildSpawnPointsFromGeneratedLevel(
        generatedLevel,
        levelGrid,
        scale.rabbitRadius,
        width,
        groundY,
      );
      const fallbackGroundLineY = groundY - scale.rabbitRadius - 2;
      const fallbackGroundTolerance = Math.max(2, scale.rabbitRadius * 0.15);
      rabbitSpawnSystem.setSpawnPlan(fallbackPoints.map((point) => ({
        position: {
          x: point.x,
          y: point.y,
        },
        allowedTypes: ['normal', 'golden'],
        isGround: Math.abs(point.y - fallbackGroundLineY) <= fallbackGroundTolerance,
      })));
    }

    rabbitSpawnSystem.fillInitialSlots();
  }

  function spawnMissEffect(position: Vector2): void {
    const scaledCount = Math.round((GAMEPLAY_CONFIG.missParticleCount + 5) * clamp(runtimeScale.worldScale, 0.8, 1.3));
    const missParticles = createMissParticles(position, scaledCount);

    for (const particle of missParticles) {
      particleLayer.addChild(particle.display);
      particles.push(particle);
    }
  }

  function spawnHitEffect(position: Vector2, rabbitType: RabbitType): void {
    const hitParticles = createHitParticles(position, rabbitType);

    for (const particle of hitParticles) {
      particleLayer.addChild(particle.display);
      particles.push(particle);
    }
  }

  function handleMiss(position: Vector2): void {
    session.misses += 1;

    const hadCombo = session.combo > 1;
    resetComboOnMiss(session);
    syncHud();

    spawnMissEffect({
      x: position.x,
      y: position.y - 4,
    });

    audioSystem.play('miss');

    if (hadCombo) {
      showComboBanner('Комбо втрачено', 0xfca5a5);
    }
  }

  function handleConstructionHits(): void {
    const projectiles = [...projectileSystem.getProjectiles()];

    for (const projectile of projectiles) {
      for (const block of constructions) {
        if (!doesCircleIntersectRect(projectile.position, projectile.radius, block)) {
          continue;
        }

        projectileSystem.removeById(projectile.id);
        handleMiss(projectile.position);
        break;
      }
    }
  }

  function handleHits(): void {
    const hits = detectProjectileRabbitHits(
      projectileSystem.getProjectiles(),
      rabbitSpawnSystem.getActiveRabbits(),
    );

    if (hits.length === 0) {
      return;
    }

    for (const hit of hits) {
      projectileSystem.removeById(hit.projectileId);

      const rabbit = rabbitSpawnSystem.handleHit(hit.rabbitId);
      if (!rabbit) {
        continue;
      }

      const comboMultiplier = consumeComboMultiplierOnHit(session);
      const gainedScore = applyHitScore(session, hit.rabbitType, comboMultiplier);
      session.hits += 1;

      spawnHitEffect(hit.position, hit.rabbitType);

      const scoreColor = hit.rabbitType === 'golden' ? 0xfef08a : 0xf8fafc;
      spawnFloatingFeedback(`+${gainedScore}`, hit.position, scoreColor);

      if (hit.rabbitType === 'golden') {
        audioSystem.play('hit-golden');
      } else {
        audioSystem.play('hit-normal');
      }

      if (comboMultiplier >= 2) {
        audioSystem.play('combo');
        showComboBanner(`Комбо x${session.combo}`, 0xfde68a);
      }
    }

    syncHud();
  }

  function updateParticles(deltaSeconds: number): void {
    for (let index = particles.length - 1; index >= 0; index -= 1) {
      const particle = particles[index];

      const stillAlive = updateMissParticle(
        particle,
        deltaSeconds,
        GAMEPLAY_CONFIG.missParticleGravity,
      );

      if (stillAlive) {
        continue;
      }

      particleLayer.removeChild(particle.display);
      particle.display.destroy();
      particles.splice(index, 1);
    }
  }

  function updateFloatingFeedback(deltaMs: number): void {
    const deltaSeconds = deltaMs / 1000;

    for (let index = floatingFeedbacks.length - 1; index >= 0; index -= 1) {
      const feedback = floatingFeedbacks[index];
      feedback.ageMs += deltaMs;

      const progress = feedback.ageMs / feedback.lifeMs;
      if (progress >= 1) {
        feedbackLayer.removeChild(feedback.label);
        feedback.label.destroy();
        floatingFeedbacks.splice(index, 1);
        continue;
      }

      feedback.velocity.y += 120 * deltaSeconds;

      feedback.label.x += feedback.velocity.x * deltaSeconds;
      feedback.label.y += feedback.velocity.y * deltaSeconds;
      feedback.label.alpha = 1 - progress;
      feedback.label.scale.set(0.9 + ((1 - progress) * 0.3));
    }
  }

  function updateComboBanner(deltaMs: number): void {
    if (comboBannerTimerMs <= 0) {
      comboBanner.alpha = 0;
      return;
    }

    comboBannerTimerMs = Math.max(0, comboBannerTimerMs - deltaMs);

    const progress = 1 - (comboBannerTimerMs / 640);
    comboBanner.alpha = Math.min(1, progress * 2.2) * Math.min(1, comboBannerTimerMs / 220);
    const pulseScale = 0.88 + (0.2 * (1 - progress));
    comboBanner.scale.set(comboBannerBaseScale * pulseScale);
  }

  function checkForGameOver(): void {
    if (roundFinished || leavingToMenu) {
      return;
    }

    if (session.ammo > 0) {
      return;
    }

    if (projectileSystem.getCount() > 0) {
      return;
    }

    roundFinished = true;
    audioSystem.play('game-over');
    setLatestGameRunSummary(createRunSummary(session));
    void sceneController.changeScene(SCENES.GAME_OVER);
  }

  return {
    key: SCENES.GAME,
    container,
    onEnter: () => {
      roundFinished = false;
      leavingToMenu = false;
      fullscreenAutoAttempted = false;
      orientationLockAttempted = false;
      document.body.classList.add(GAME_SCENE_BODY_CLASS);

      if (arenaBounds.width > 0 && arenaBounds.height > 0) {
        rabbitSpawnSystem.fillInitialSlots();
      }

      comboBanner.alpha = 0;
      syncSoundEffectsLabel();
      syncFullscreenButton();
      syncHud();

      window.addEventListener('keydown', onEscapeKeyDown);
      document.addEventListener('fullscreenchange', onFullscreenChange);
      document.addEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);
      interactionLayer.on('pointerdown', onAnyUserGesture);
      orientationOverlay.on('pointerdown', onAnyUserGesture);
    },
    onResize: (width, height) => {
      const viewport = computeGameViewport(width, height);
      lastViewport = viewport;
      const sceneWidth = viewport.worldWidth;
      const sceneHeight = viewport.worldHeight;

      sceneRoot.rotation = 0;
      sceneRoot.position.set(0, 0);
      worldLayer.scale.set(1);
      worldLayer.position.set(0, 0);
      uiLayer.scale.set(1);
      uiLayer.position.set(0, 0);

      orientationBlocked = viewport.isMobile && viewport.isPortrait;

      const scaleLayout = resolveRuntimeScaleForScene(sceneWidth, sceneHeight);
      runtimeScale = scaleLayout.scale;

      arenaBounds = {
        width: sceneWidth,
        height: sceneHeight,
        groundY: scaleLayout.groundY,
      };
      syncOrientationOverlay(sceneWidth, sceneHeight);

      redrawArena();

      turret.setTargetWidth(runtimeScale.turretWidth);
      const turretX = Math.max(runtimeScale.turretOffsetX, sceneWidth * 0.12);
      const turretY = arenaBounds.groundY - runtimeScale.turretOffsetFromGround;
      turret.setPosition(turretX, turretY);

      projectileSystem.setProjectileRadius(runtimeScale.projectileRadius);
      projectileSystem.setGravity(GAMEPLAY_CONFIG.gravity * clamp(runtimeScale.worldScale, 0.88, 1.18));
      rabbitSpawnSystem.setRabbitRadius(runtimeScale.rabbitRadius);

      effectiveMaxPullDistance = runtimeScale.maxPullDistance;
      aimSystem.setMaxPullDistance(effectiveMaxPullDistance);

      shotSpeedMultiplier = computeShotSpeedMultiplier(sceneWidth, runtimeScale.worldScale);

      updateConstructionLayout(sceneWidth, arenaBounds.groundY, runtimeScale);

      interactionLayer.hitArea = new Rectangle(0, 0, sceneWidth, sceneHeight);
      interactionLayer.eventMode = orientationBlocked ? 'none' : 'static';

      const baseUiScale = clamp(Math.min(sceneWidth / 390, sceneHeight / 820), 0.78, 1);
      const uiScale = viewport.isMobile
        ? clamp(baseUiScale * MOBILE_UI_SCALE_FACTOR, 0.68, 0.95)
        : baseUiScale;
      hint.scale.set(uiScale);
      hint.x = sceneWidth * 0.5;
      hint.y = Math.max(22, 28 * uiScale);

      comboBannerBaseScale = uiScale;
      comboBanner.scale.set(comboBannerBaseScale);
      comboBanner.x = sceneWidth * 0.5;
      comboBanner.y = Math.max(70, sceneHeight * 0.26);

      const baseUtilityScale = clamp(Math.min(sceneWidth / 420, sceneHeight / 900), 0.76, 1);
      const utilityButtonScale = viewport.isMobile
        ? clamp(baseUtilityScale * MOBILE_UI_SCALE_FACTOR, 0.68, 0.94)
        : baseUtilityScale;
      menuButton.scale.set(utilityButtonScale);
      soundEffectsButton.scale.set(utilityButtonScale);

      menuButton.x = sceneWidth - (74 * utilityButtonScale);
      menuButton.y = Math.max(26, 30 * utilityButtonScale);

      soundEffectsButton.x = sceneWidth - (102 * utilityButtonScale);
      soundEffectsButton.y = menuButton.y + (28 * utilityButtonScale);

      fullscreenButton.scale.set(utilityButtonScale);
      fullscreenButton.x = soundEffectsButton.x;
      fullscreenButton.y = soundEffectsButton.y + (28 * utilityButtonScale);
      syncFullscreenButton(viewport);

      hud.resize(sceneWidth, sceneHeight);
      if (orientationBlocked) {
        aimSystem.cancelDrag();
        drawAimGuide(aimSystem.getAngleRad(), 0, false);
      } else {
        drawAimGuide(aimSystem.getAngleRad(), aimSystem.getPowerRatio(), false);
      }
    },
    update: (deltaMs) => {
      if (orientationBlocked) {
        return;
      }

      const deltaSeconds = deltaMs / 1000;

      projectileSystem.update(deltaSeconds, arenaBounds, handleMiss);
      handleConstructionHits();
      handleHits();
      rabbitSpawnSystem.update(deltaMs);
      updateParticles(deltaSeconds);
      updateFloatingFeedback(deltaMs);
      updateComboBanner(deltaMs);
      hud.tick(deltaMs);
      checkForGameOver();
    },
    onExit: () => {
      window.removeEventListener('keydown', onEscapeKeyDown);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', onFullscreenChange as EventListener);
      interactionLayer.off('pointerdown', onAnyUserGesture);
      orientationOverlay.off('pointerdown', onAnyUserGesture);
      document.body.classList.remove(GAME_SCENE_BODY_CLASS);

      aimSystem.destroy();
      projectileSystem.destroy();
      rabbitSpawnSystem.destroy();

      for (const particle of particles) {
        particleLayer.removeChild(particle.display);
        particle.display.destroy();
      }

      for (const feedback of floatingFeedbacks) {
        feedbackLayer.removeChild(feedback.label);
        feedback.label.destroy();
      }

      for (const tile of dirtTiles) {
        dirtTileLayer.removeChild(tile);
        tile.destroy();
      }

      for (const tile of groundCapTiles) {
        groundCapLayer.removeChild(tile);
        tile.destroy();
      }

      for (const tile of constructionTiles) {
        constructionLayer.removeChild(tile);
        tile.destroy();
      }

      particles.length = 0;
      floatingFeedbacks.length = 0;
      dirtTiles.length = 0;
      groundCapTiles.length = 0;
      constructionTiles.length = 0;
    },
  };
}

function getSoundEffectsLabel(enabled: boolean): string {
  return enabled ? 'Звукові ефекти: Увімк.' : 'Звукові ефекти: Вимк.';
}

function buildSpawnPointsFromGeneratedLevel(
  level: GeneratedLevel,
  grid: LevelGrid,
  rabbitRadius: number,
  width: number,
  groundY: number,
): Vector2[] {
  const points: Vector2[] = [];

  for (const cell of level.standableCells) {
    const worldCell = gridToWorld(cell, grid);
    points.push({
      x: worldCell.x + (grid.tileSize * 0.5),
      y: worldCell.y - rabbitRadius - 2,
    });
  }

  const unique = uniquePoints(points);
  if (unique.length >= 4) {
    return unique;
  }

  const groundYLine = groundY - rabbitRadius - 2;
  const constructions = buildWorldConstructionCollisionRects(level, grid);

  const minFloorX = width * 0.36;
  const maxFloorX = width * 0.97;
  const floorStep = Math.max(54, rabbitRadius * 2.15);
  for (let x = minFloorX; x <= maxFloorX; x += floorStep) {
    const point = { x, y: groundYLine };
    if (isPointInsideAnyConstruction(point, constructions, rabbitRadius * 0.4)) {
      continue;
    }

    points.push(point);
  }

  const floorUnique = uniquePoints(points);
  if (floorUnique.length > 0) {
    return floorUnique;
  }

  return [
    { x: width * 0.62, y: groundYLine },
    { x: width * 0.78, y: groundYLine },
    { x: width * 0.9, y: groundYLine },
  ];
}

function uniquePoints(points: Vector2[]): Vector2[] {
  const result: Vector2[] = [];
  const keys = new Set<string>();

  for (const point of points) {
    const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
    if (keys.has(key)) {
      continue;
    }

    keys.add(key);
    result.push(point);
  }

  return result;
}

function isPointInsideAnyConstruction(point: Vector2, constructions: RectBounds[], margin: number): boolean {
  for (const block of constructions) {
    if (
      point.x >= (block.x - margin)
      && point.x <= (block.x + block.width + margin)
      && point.y >= (block.y - margin)
      && point.y <= (block.y + block.height + margin)
    ) {
      return true;
    }
  }

  return false;
}

function buildWorldConstructionCollisionRects(level: GeneratedLevel, grid: LevelGrid): RectBounds[] {
  return level.modules
    .filter((module) => module.kind !== 'ground-strip')
    .flatMap((module) => module.collisionRects)
    .map((rect) => gridRectToWorldRect(rect, grid))
    .map((worldRect) => ({
      x: worldRect.x,
      y: worldRect.y,
      width: worldRect.width,
      height: worldRect.height,
    }));
}

function doesCircleIntersectRect(circle: Vector2, radius: number, rect: RectBounds): boolean {
  const closestX = clamp(circle.x, rect.x, rect.x + rect.width);
  const closestY = clamp(circle.y, rect.y, rect.y + rect.height);

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;

  return ((dx * dx) + (dy * dy)) <= (radius * radius);
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function computeGameViewport(width: number, height: number): GameViewport {
  const shortSide = Math.min(width, height);
  const isMobile = shortSide <= 900;
  const isPortrait = height > width;

  return {
    worldWidth: width,
    worldHeight: height,
    isMobile,
    isPortrait,
  };
}

function resolveRuntimeScaleForScene(sceneWidth: number, sceneHeight: number): {
  scale: RuntimeScale;
  groundY: number;
} {
  let groundY = sceneHeight - GAMEPLAY_CONFIG.groundHeight;
  let scale = DEFAULT_RUNTIME_SCALE;

  // One refinement step keeps tile-size-derived scale and ground offsets consistent.
  for (let pass = 0; pass < 2; pass += 1) {
    const grid = createLevelGrid({
      arenaWidth: sceneWidth,
      arenaHeight: sceneHeight,
      groundY,
    });
    scale = deriveRuntimeScaleFromGrid(grid);
    groundY = sceneHeight - scale.groundHeight;
  }

  return {
    scale,
    groundY,
  };
}

function deriveRuntimeScaleFromGrid(grid: LevelGrid): RuntimeScale {
  const worldScale = clamp(grid.tileSize / BASE_TILE_SIZE, 0.78, 1.3);

  return {
    worldScale,
    turretWidth: clamp(BASE_TURRET_WIDTH * worldScale, 120, 232),
    rabbitRadius: clamp(GAMEPLAY_CONFIG.rabbitRadius * worldScale, 15, 38),
    projectileRadius: clamp(GAMEPLAY_CONFIG.projectileRadius * worldScale, 6, 16),
    maxPullDistance: clamp(GAMEPLAY_CONFIG.maxDragDistance * worldScale * 0.72, 92, 210),
    turretOffsetX: clamp(GAMEPLAY_CONFIG.turretOffsetX * worldScale, 54, 132),
    turretOffsetFromGround: clamp(GAMEPLAY_CONFIG.turretOffsetFromGround * worldScale, 8, 34),
    groundHeight: clamp(GAMEPLAY_CONFIG.groundHeight * worldScale, 86, 176),
  };
}

function computeShotSpeedMultiplier(sceneWidth: number, worldScale: number): number {
  const normalized = sceneWidth / REFERENCE_WIDTH;
  const widthFactor = clamp(0.95 + ((normalized - 1) * 0.55), 0.95, 1.7);
  return clamp(widthFactor * clamp(worldScale, 0.9, 1.16), 0.92, 1.78);
}

function drawRotateDeviceGlyph(glyph: Graphics, size: number): void {
  const half = size * 0.5;
  const phoneW = size * 0.32;
  const phoneH = size * 0.52;

  glyph.clear();
  glyph.roundRect(-phoneW * 0.5, -phoneH * 0.5, phoneW, phoneH, size * 0.08);
  glyph.stroke({ color: 0xe2e8f0, width: clamp(size * 0.045, 2, 6), alpha: 0.95 });

  glyph.roundRect(-phoneH * 0.26, -phoneW * 0.42, phoneH * 0.52, phoneW * 0.84, size * 0.07);
  glyph.stroke({ color: 0x38bdf8, width: clamp(size * 0.036, 2, 5), alpha: 0.9 });

  glyph.arc(-half * 0.2, -half * 0.22, half * 0.72, Math.PI * 0.18, Math.PI * 0.87);
  glyph.stroke({ color: 0xf8fafc, width: clamp(size * 0.04, 2, 5), alpha: 0.88 });

  const arrowTipX = (-half * 0.2) + (Math.cos(Math.PI * 0.87) * half * 0.72);
  const arrowTipY = (-half * 0.22) + (Math.sin(Math.PI * 0.87) * half * 0.72);
  glyph.poly([
    arrowTipX,
    arrowTipY,
    arrowTipX - (size * 0.14),
    arrowTipY - (size * 0.02),
    arrowTipX - (size * 0.05),
    arrowTipY + (size * 0.12),
  ]);
  glyph.fill({ color: 0xf8fafc, alpha: 0.92 });
}

function mixColors(fromColor: number, toColor: number, t: number): number {
  const clamped = clamp(t, 0, 1);
  const fromR = (fromColor >> 16) & 0xff;
  const fromG = (fromColor >> 8) & 0xff;
  const fromB = fromColor & 0xff;
  const toR = (toColor >> 16) & 0xff;
  const toG = (toColor >> 8) & 0xff;
  const toB = toColor & 0xff;

  const mixedR = Math.round(fromR + ((toR - fromR) * clamped));
  const mixedG = Math.round(fromG + ((toG - fromG) * clamped));
  const mixedB = Math.round(fromB + ((toB - fromB) * clamped));

  return (mixedR << 16) | (mixedG << 8) | mixedB;
}

interface FullscreenCapableElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void;
  mozRequestFullScreen?: () => Promise<void> | void;
  msRequestFullscreen?: () => Promise<void> | void;
}

interface FullscreenCapableDocument extends Document {
  webkitFullscreenElement?: Element | null;
  mozFullScreenElement?: Element | null;
  msFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  mozCancelFullScreen?: () => Promise<void> | void;
  msExitFullscreen?: () => Promise<void> | void;
}

function supportsFullscreenMode(element: HTMLElement): boolean {
  const target = element as FullscreenCapableElement;

  return Boolean(
    target.requestFullscreen
      || target.webkitRequestFullscreen
      || target.mozRequestFullScreen
      || target.msRequestFullscreen,
  );
}

function isFullscreenActive(): boolean {
  const doc = document as FullscreenCapableDocument;

  return Boolean(
    doc.fullscreenElement
      || doc.webkitFullscreenElement
      || doc.mozFullScreenElement
      || doc.msFullscreenElement,
  );
}

async function toggleFullscreen(element: HTMLElement): Promise<void> {
  if (isFullscreenActive()) {
    await exitFullscreen();
    return;
  }

  await requestFullscreen(element);
}

async function requestFullscreen(element: HTMLElement): Promise<void> {
  const target = element as FullscreenCapableElement;
  const request =
    target.requestFullscreen?.bind(target)
    ?? target.webkitRequestFullscreen?.bind(target)
    ?? target.mozRequestFullScreen?.bind(target)
    ?? target.msRequestFullscreen?.bind(target);

  if (!request) {
    return;
  }

  try {
    await request();
  } catch {
    // Ignore user-agent restrictions (gesture timing, permissions, etc.).
  }
}

async function exitFullscreen(): Promise<void> {
  const doc = document as FullscreenCapableDocument;
  const exit =
    doc.exitFullscreen?.bind(doc)
    ?? doc.webkitExitFullscreen?.bind(doc)
    ?? doc.mozCancelFullScreen?.bind(doc)
    ?? doc.msExitFullscreen?.bind(doc);

  if (!exit) {
    return;
  }

  try {
    await exit();
  } catch {
    // Ignore if browser blocks or no fullscreen session exists.
  }
}
