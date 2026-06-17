// ===========================================================================
//  CONFIG  --  All the numbers you can change to make the game feel different!
//  This is the BEST file to play with. Change a number, save, refresh the
//  browser, and see what happens. Nothing here can "break" the game.
// ===========================================================================

const CONFIG = {

  // ---- The size of the game picture (in pixels) ----
  // Small numbers make a chunky, retro pixel look. The picture is stretched
  // bigger to fill your screen, but it's really only drawn this small.
  // Bigger numbers here = the camera is "zoomed out" so you see more sky,
  // more ground, and more of the battle at once.
  GAME_W: 2560,
  GAME_H: 1440,

  // ---- How the plane flies ----
  // (These are the fun ones to experiment with!)

  THRUST: 0.13,        // How hard the engine pushes. Bigger = faster plane.
  TURN_SPEED: 0.065,   // How fast the nose turns. Bigger = spins quicker.
  GRAVITY: 0.05,       // How hard the ground pulls the plane down.
  DRAG: 0.987,         // Air resistance. Tuned so your cruise speed scales with
                       // the throttle (about throttle x MAX_SPEED).

  // Real-ish aerodynamics: the wings make LIFT at RIGHT ANGLES to the way the
  // plane is actually moving (not always straight up), and only when there's
  // enough airspeed. Point too steeply ("angle of attack") or fly too slow and
  // the wings STALL -- lift collapses and gravity takes over. WEATHERVANE is
  // how strongly the nose swings to follow the wind, which helps you recover
  // from a stall by dropping the nose into a dive.
  IDLE_SINK: 0.08,     // How quickly low throttle drags you down to the fall
                       // speed. At throttle 0 you sink at about normal flying
                       // speed; throttle back up to recover.
  LIFT: 0.04,          // How strong the wings' lift is (drives the climb).
  CAMBER: 0.25,        // Lift even when flying level, so the plane holds height
                       // (but still stalls pointing straight up). Bigger = floatier.
  WEATHERVANE: 0.03,   // How fast the nose swings to follow the airflow.
  DRAG_AOA: 0.02,      // Extra drag when the nose isn't lined up with travel.

  THROTTLE_RATE: 0.015,   // How quickly the throttle drops when you ease off.
  THROTTLE_UP_RATE: 0.005, // How quickly the throttle BUILDS up (slow, so it
                          // doesn't just race straight to full speed).
  START_THROTTLE: 0.6, // How much gas the plane starts with.

  MAX_SPEED: 10,       // The fastest the plane is allowed to go.

  // ---- The camera (the view that follows the plane) ----
  CAM_SMOOTH: 0.08,    // How smoothly the camera catches up. Smaller = lazier.
  CAM_LOOKAHEAD: 60,   // How far ahead it peeks in the direction you're flying.

  // ---- The world ----
  GROUND_Y: 400,       // How far down the ground is (in game pixels).
  // The level is this many pixels long. When you fly off one side you pop out
  // the other side -- so it's a big loop. The rescue barn sits in the middle.
  WORLD_WIDTH: 8000,

  // ---- Sky ceiling & stalling (BitPlanes-style!) ----
  // (y counts DOWN, so "up high" is a big negative number.)
  // Climb too high and the air gets thin: your wings make less lift and your
  // engine weakens, so you STALL and sink back down. Fly too SLOW and you
  // stall too. Dive to get your speed (and control) back.
  CEILING: -2200,      // the very top of the sky -- you can't fly past this.

  // --- Alien Invasion (tag) mode ---
  UFO_SPEED: 10,       // how fast a UFO flies -- the SAME as a plane's top
                       // speed (MAX_SPEED=10), so it's a fair, even chase.
  UFO_TAG_RANGE: 30,   // how close a UFO must get to TAG a runner.

  STALL_ALT: -700,     // above this height the air thins out and lift fades.
  // The throttle bar tops out at MAX_SPEED (10). Flying level you can go as
  // slow as 1/8 of the bar before stalling; climbing straight up needs 1/4.
  STALL_SPEED: 1.25,   // level (horizontal) stall speed = 1/8 of the bar.
  STALL_SPEED_UP: 2.5, // straight-up stall speed = 1/4 of the bar.
  STALL_DRAG: 0.05,    // small extra brake from a badly-stalled (sideways) wing.
  TURN_FULL_SPEED: 4,  // reference speed for control.

  // ---- Guns & bullets ----
  // (Press SPACE to shoot. Try changing these!)
  BULLET_SPEED: 14,    // How fast bullets fly out of the nose (faster than planes).
  BULLET_LIFE: 70,     // How many frames a bullet lives before it vanishes.
  FIRE_COOLDOWN: 10,   // Frames to wait between shots. Smaller = faster gun.
  BULLET_SIZE: 6,      // How big/thick each bullet tracer looks (in pixels).

  // ---- Missiles (press X) ----
  // You carry a few homing missiles. They CHASE the nearest enemy, but only
  // while they have fuel -- once the fuel runs out they fly straight, so a
  // sharp-turning plane can dodge them!
  MISSILE_MAX: 5,            // how many missiles you can hold
  MISSILE_REFILL_SECONDS: 20,// you get one more missile every this many seconds
  MISSILE_SPEED: 11,         // a tiny bit faster than your top speed (MAX_SPEED)
  MISSILE_TURN: 0.15,        // sharp turn: smallest turn circle ~3 biplanes wide
  MISSILE_FUEL: 600,         // it chases for about 10 seconds, then flies straight
  MISSILE_LIFE: 720,         // frames before it fizzles out completely
  MISSILE_DAMAGE: 4,         // a missile takes off 4 health (so 3 missiles = dead)

  // ---- The player's health & eject ----
  PLAYER_HEALTH: 10,   // 10 bullets to be shot down.
  PLAYER_RESPAWN: 90,  // Frames before you fly back in after being shot down.
  // Press C to EJECT: you bail out and float down on a parachute. If you
  // steer your parachute to the big barn in the middle you respawn and KEEP
  // your points. But if you get shot down instead, your points reset to 0!
  EJECT_UP: 3,             // little upward hop when you bail out
  PARACHUTE_FALL: 0.7,     // how fast the parachute sinks
  PARACHUTE_DRIFT: 0.9,    // how fast you can steer the parachute left/right
  PILOT_WALK: 3,           // how fast the pilot walks on the ground
  BARN_RESCUE_RANGE: 110,  // how close to the barn counts as "rescued"
  // Land gently and you're fine; come down too fast or too steep and you crash.
  LAND_MAX_VY: 2.6,        // max downward speed for a safe landing
  LAND_MAX_ANGLE: 0.45,    // max nose tilt from level for a safe landing

  // ---- Enemy planes ----
  // Every bot has its OWN color and its OWN flying style, and they all fight
  // each other AND you (a free-for-all). They lead their shots, dodge, and
  // even fire homing missiles. These numbers are the "average" bot; each one
  // varies a bit around them (see js/enemy.js for the personalities).
  ENEMY_COUNT: 10,        // How many enemy planes are in the sky at once.
  ENEMY_THRUST: 0.11,     // Engine power for enemies (yours is THRUST above).
  ENEMY_TURN: 0.045,      // How fast enemies turn their nose. Bigger = nimbler.
  ENEMY_HEALTH: 10,       // 10 bullets to pop a bot, same as you.
  ENEMY_FIRE_RANGE: 175,  // How close an enemy must be before it shoots.
  ENEMY_AIM: 0.26,        // How well-aimed it must be to fire (bigger = sloppier).
  ENEMY_FIRE_COOLDOWN: 36,// Frames between an enemy's shots (bigger = shoots less).
  ENEMY_RESPAWN: 160,     // Frames before a downed enemy flies back in.
  ENEMY_MISSILE_COOLDOWN: 220, // base frames between a bot's missiles.
  ENEMY_BUBBLE_SEEK_RANGE: 520, // how far a bot will detour to grab a power-up.

  // ---- Power-up bubbles (fly into them!) ----
  // shield = invincible for a bit, turret = wide 5-bullet shot, skull = BAD
  // (freezes you and costs you half your health).
  POWERUP_INTERVAL: 150,   // frames between new bubbles appearing
  POWERUP_PER_TYPE: 3,     // keep this many of EACH kind spread around the map
  POWERUP_RADIUS: 15,      // how big a bubble is
  POWERUP_LIFE: 1200,      // frames a bubble floats before it pops on its own
  SHIELD_TIME: 600,        // shield: 10 seconds of being invincible
  WIDE_SHOT_TIME: 600,     // turret: 10 seconds of the wide 5-bullet shot
  WIDE_SHOT_SPREAD: 0.14,  // angle between the 5 wide-shot bullets
  FREEZE_TIME: 300,        // skull: frozen (no control) for 5 seconds

  // ---- WW2 Mode ----
  WW2_TURN_MULT: 0.5,   // planes turn much slower in WW2 mode
  WW2_BLACK_COUNT: 5,   // the black team has this many planes

  // ---- Bad Weather Mode ----
  BW_WIND: 0.05,            // wind blows right: faster flying right, slower left
  BW_TAILWIND_MULT: 1.9,    // top-speed multiplier when you're flying right
  BW_LIGHTNING_INTERVAL: 300, // frames between lightning strikes (~5 seconds)

  // ---- Off-screen enemy arrows (point toward enemies you can't see) ----
  SHOW_ENEMY_ARROWS: true, // turn the edge arrows on or off
  ARROW_MARGIN: 12,        // how far the arrows sit in from the screen edge
  ARROW_SIZE: 5,           // how big each arrow is

  // ---- Colors (you can change these to recolor the game!) ----
  COLORS: {
    skyTop:    '#7aa7c2', // muted vintage sky blue up high
    skyBottom: '#f2e4c0', // warm, hazy golden horizon (old-photo feel)
    hills:     '#5a8f3a', // far away hills
    ground:    '#6ab04c', // the grassy ground
    groundDark:'#4f8a3a', // a darker stripe on the ground
    plane:     '#e74c3c', // the plane body
    planeDark: '#a83227', // plane shadows
    propeller: '#2c3e50', // the spinning propeller
    cloud:     '#ffffff', // clouds
    bullet:    '#fff27a', // YOUR bullets (yellow)
    enemyBullet:'#ff5a4a',// enemy bullets (red = incoming danger!)
    enemy:     '#9b59b6', // purple enemy team
    enemyDark: '#6c3483', // purple enemy shadows
    enemy2:    '#e67e22', // orange enemy team
    enemy2Dark:'#a85916', // orange enemy shadows
    explosion: '#ffce54', // explosion sparks
    missile:   '#ecf0f1', // missile body (white)
    missileTip:'#ffd23f', // missile nose
    missileFin:'#c0392b', // missile fins
    smoke:     '#cfcfcf', // missile smoke trail

    // ---- Detailed plane parts (used by the biplane drawing) ----
    cowl:    '#34495e', // metal engine cover at the front
    metal:   '#95a5a6', // shiny metal bits (propeller hub)
    wheel:   '#2c3e50', // tires and propeller blade
    glass:   '#aee0ff', // cockpit window
    pilot:   '#f1c27d', // the pilot's head
    strut:   '#7a5230', // wooden struts between the wings

    // ---- Scenery (the countryside in the distance) ----
    hillFar:    '#6f9e54', // far rolling hills
    hillNear:   '#5a8f3a', // nearer hills
    treeline:   '#2f5e27', // a dark band of far-away trees
    treeTrunk:  '#6b4423', // tree trunks
    treeLeaf:   '#3e7d34', // tree leaves
    treeLeafDk: '#2f5e27', // tree leaf shadow
    barnWall:   '#b5402f', // red barn walls
    barnRoof:   '#5a3b2e', // barn roof
    barnDoor:   '#7a2a1e', // barn door
    hay:        '#e3c466', // haybales
    hayDark:    '#c9a23f', // haybale shadow

    // ---- Stardew-style cozy details ----
    grassLt:    '#86c25a', // bright grass highlight tufts
    grassDk:    '#4f8a3a', // darker grass blades
    flowerR:    '#e74c3c', // red flowers
    flowerY:    '#f6d743', // yellow flowers
    flowerW:    '#ffffff', // white flowers
    flowerP:    '#b39ddb', // purple flowers
    berry:      '#e0413a', // berries on bushes
    fence:      '#a9784b', // fence wood
    fenceDk:    '#7a5230', // fence wood shadow
    treeLeafLt: '#5fae4a', // tree canopy highlight
  },
};
