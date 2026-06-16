// ===========================================================================
//  CONFIG  --  All the numbers you can change to make the game feel different!
//  This is the BEST file to play with. Change a number, save, refresh the
//  browser, and see what happens. Nothing here can "break" the game.
// ===========================================================================

const CONFIG = {

  // ---- The size of the game picture (in pixels) ----
  // Small numbers make a chunky, retro pixel look. The picture is stretched
  // bigger to fill your screen, but it's really only drawn this small.
  GAME_W: 480,
  GAME_H: 270,

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
  GROUND_Y: 250,       // How far down the ground is (in game pixels).

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
  },
};
