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
  GAME_W: 1200,
  GAME_H: 675,

  // ---- How the plane flies ----
  // (These are the fun ones to experiment with!)

  THRUST: 0.09,        // How hard the engine pushes. Bigger = faster plane.
  TURN_SPEED: 0.055,   // How fast the nose turns. Bigger = spins quicker.
  GRAVITY: 0.035,      // How hard the ground pulls the plane down.
  DRAG: 0.992,         // Air resistance. Closer to 1 = the plane glides more.

  THROTTLE_RATE: 0.03, // How quickly the throttle (gas pedal) changes.
  START_THROTTLE: 0.6, // How much gas the plane starts with.

  MAX_SPEED: 6,        // The fastest the plane is allowed to go.

  // ---- The camera (the view that follows the plane) ----
  CAM_SMOOTH: 0.08,    // How smoothly the camera catches up. Smaller = lazier.
  CAM_LOOKAHEAD: 60,   // How far ahead it peeks in the direction you're flying.

  // ---- The world ----
  GROUND_Y: 400,       // How far down the ground is (in game pixels).

  // ---- Guns & bullets ----
  // (Press SPACE to shoot. Try changing these!)
  BULLET_SPEED: 5,     // How fast bullets fly out of the nose.
  BULLET_LIFE: 70,     // How many frames a bullet lives before it vanishes.
  FIRE_COOLDOWN: 10,   // Frames to wait between shots. Smaller = faster gun.
  BULLET_SIZE: 3,      // How big each bullet looks (in pixels).

  // ---- The player's health ----
  PLAYER_HEALTH: 5,    // How many hits you can take before going down.
  PLAYER_RESPAWN: 90,  // Frames before you fly back in after being shot down.

  // ---- Enemy planes (they fly, chase, and shoot — at YOU and each other!) ----
  ENEMY_COUNT: 4,         // How many enemy planes are in the sky at once.
  ENEMY_THRUST: 0.07,     // Engine power for enemies (yours is THRUST above).
  ENEMY_TURN: 0.04,       // How fast enemies turn their nose. Bigger = nimbler.
  ENEMY_HEALTH: 3,        // How many hits an enemy can take before it pops.
  ENEMY_FIRE_RANGE: 150,  // How close an enemy must be before it shoots.
  ENEMY_AIM: 0.30,        // How well-aimed it must be to fire (bigger = sloppier).
  ENEMY_FIRE_COOLDOWN: 35,// Frames between an enemy's shots (bigger = shoots less).
  ENEMY_RESPAWN: 150,     // Frames before a downed enemy flies back in.

  // ---- Off-screen enemy arrows (point toward enemies you can't see) ----
  SHOW_ENEMY_ARROWS: true, // turn the edge arrows on or off
  ARROW_MARGIN: 12,        // how far the arrows sit in from the screen edge
  ARROW_SIZE: 5,           // how big each arrow is

  // ---- Colors (you can change these to recolor the game!) ----
  COLORS: {
    skyTop:    '#3aa0e0', // sky color up high
    skyBottom: '#bfe6ff', // sky color near the ground
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
  },
};
