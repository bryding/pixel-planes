// ===========================================================================
//  NET  --  the client side of online play. Talks to the Pixel Planes server
//  over a WebSocket to join the ONE shared world: send your name, then send
//  your plane's position and receive everyone else's.
//
//  There are no rooms/hosts/passwords any more — connecting and saying "hello"
//  with a name puts you straight into the single live sky.
//
//  Robust connection handling:
//   • clear status (offline / connecting / online) and friendly error text
//   • connection TIMEOUT (so it never just hangs forever)
//   • AUTO-RECONNECT with backoff
//   • detects the classic "https page can't use ws://" mistake and explains it
// ===========================================================================

const Net = {
  ws: null,
  status: 'offline',     // 'offline' | 'connecting' | 'online'
  myId: null,
  username: '',
  inWorld: false,        // have we said hello and been welcomed?
  target: 0,             // how many planes the world wants (from welcome)
  tickHz: 0,             // snapshot rate the server runs at (from welcome)
  lastError: '',
  onChange: null,        // game.js sets this to refresh status UI

  // game.js fills these in to receive world events:
  onWelcome: null,       // (id) => ...   you're in the world
  onSnapshot: null,      // (planes) => ...   array of every plane
  onLeft: null,          // (id) => ...   a plane left
  onDenied: null,        // (msg) => ...  join refused (e.g. world is full)
  onFire: null,          // (id,kind,x,y,heading) => ... someone fired (visual+SFX)
  onHit: null,           // (byId,kind) => ... YOU got hit — take the damage
  onDown: null,          // (victimId,byId) => ... a plane was destroyed

  _url: null,
  _want: false,          // do we want to stay connected? (drives auto-reconnect)
  _connectTimer: null,
  _reconnectTimer: null,
  _retryDelay: 1000,

  // Ask to be connected to `url` (and keep trying if it drops).
  connect(url) {
    if (url) this._url = url;
    this._want = true;
    this._open();
  },

  // Stop trying / close the socket.
  disconnect() {
    this._want = false;
    clearTimeout(this._reconnectTimer);
    clearTimeout(this._connectTimer);
    if (this.ws) { try { this.ws.close(); } catch (_) {} }
  },

  // Manual "try again now".
  retry() { this._retryDelay = 1000; this._want = true; this.status = 'offline'; this._open(); },

  _open() {
    if (this.status === 'connecting' || this.status === 'online') return;
    const url = this._url;
    if (!url) { this.lastError = 'No server address set.'; this._notify(); return; }

    // The #1 gotcha: a page loaded over https can ONLY open a secure wss:// — a
    // plain ws:// is blocked by the browser as "mixed content".
    if (typeof location !== 'undefined' && location.protocol === 'https:' && /^ws:\/\//i.test(url)) {
      this.status = 'offline';
      this.lastError = 'This page is secure (https), so it can only connect to a secure server (wss://). ' +
                       'For testing on one computer, open the game over http (e.g. http://localhost:8080).';
      this._notify();
      return;   // don't auto-retry a connection the browser will always block
    }

    this.status = 'connecting';
    this.lastError = '';
    this._notify();

    let ws;
    try { ws = new WebSocket(url); }
    catch (e) { this._failed('That server address looks wrong: ' + url); return; }
    this.ws = ws;

    // If it doesn't open within 8s, treat it as unreachable (don't hang).
    clearTimeout(this._connectTimer);
    this._connectTimer = setTimeout(() => {
      if (this.status === 'connecting') { try { ws.close(); } catch (_) {} }
    }, 8000);

    ws.onopen = () => {
      clearTimeout(this._connectTimer);
      this.status = 'online';
      this._retryDelay = 1000;
      this.lastError = '';
      // Say hello with our name — that's what puts us in the world.
      this.send({ t: 'hello', name: this.username });
      this._notify();
    };
    ws.onmessage = (e) => {
      let m; try { m = JSON.parse(e.data); } catch (_) { return; }
      this._handle(m);
    };
    ws.onerror = () => { /* a close event always follows; handle it there */ };
    ws.onclose = () => {
      clearTimeout(this._connectTimer);
      const wasTrying = (this.status === 'connecting');
      this.status = 'offline';
      this.inWorld = false;
      if (!this.lastError) {
        this.lastError = wasTrying
          ? "Couldn't reach the server. Is it running, and is the address right?"
          : 'Lost connection to the server — trying to reconnect…';
      }
      this._notify();
      this._scheduleReconnect();
    };
  },

  _failed(msg) { this.status = 'offline'; this.lastError = msg; this._notify(); this._scheduleReconnect(); },

  _scheduleReconnect() {
    if (!this._want) return;
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = setTimeout(() => {
      if (this._want && this.status === 'offline') this._open();
    }, this._retryDelay);
    this._retryDelay = Math.min(Math.round(this._retryDelay * 1.7), 8000); // gentle backoff
  },

  send(obj) {
    if (this.ws && this.ws.readyState === 1) {
      try { this.ws.send(JSON.stringify(obj)); } catch (_) {}
    }
  },
  _notify() { if (typeof this.onChange === 'function') this.onChange(); },

  // Remember the name to send on connect (and re-send if already online).
  setName(n) { this.username = n; if (this.status === 'online') this.send({ t: 'hello', name: n }); },

  // Send our own plane's position for this frame.
  sendState(state) { this.send({ t: 'state', s: state }); },

  // Tell everyone we fired (so they can draw the shot + play the sound).
  sendFire(kind, x, y, heading) { this.send({ t: 'fire', kind: kind, x: x, y: y, heading: heading }); },

  // Tell the server our shot struck `targetId` (the server decides the damage).
  sendHit(targetId, kind) { this.send({ t: 'hit', targetId: targetId, kind: kind }); },

  // Handle one message from the server. (Public so it can be unit-tested.)
  _handle(m) {
    switch (m.t) {
      case 'welcome':
        this.myId = m.id;
        this.target = m.target || 0;
        this.tickHz = m.tickHz || 0;
        this.inWorld = true;
        this.lastError = '';
        if (typeof this.onWelcome === 'function') this.onWelcome(m.id);
        break;
      case 'snapshot':
        if (typeof this.onSnapshot === 'function') this.onSnapshot(m.planes || []);
        break;
      case 'player-left':
        if (typeof this.onLeft === 'function') this.onLeft(m.id);
        break;
      case 'fire':
        if (typeof this.onFire === 'function') this.onFire(m.id, m.kind, m.x, m.y, m.heading);
        break;
      case 'hit':
        if (typeof this.onHit === 'function') this.onHit(m.byId, m.kind);
        break;
      case 'down':
        if (typeof this.onDown === 'function') this.onDown(m.victimId, m.byId);
        break;
      case 'denied':
        this.lastError = m.msg || 'The world is full right now — try again in a moment.';
        if (typeof this.onDenied === 'function') this.onDenied(this.lastError);
        break;
    }
    this._notify();
  },
};
