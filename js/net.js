// ===========================================================================
//  NET  --  the client side of online play. Talks to the Pixel Planes server
//  over a WebSocket: fetches the server list, creates/joins servers (with
//  optional passwords), tracks whether YOU are the host, and relays planes.
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
  inServer: false,
  isHost: false,
  serverName: null,
  servers: [],           // [{name, hasPassword, players}]
  lastError: '',
  onChange: null,        // game.js sets this to refresh the lobby UI

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
                       'For testing on one computer, open the game over http (e.g. http://localhost:8000).';
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
      if (this.username) this.send({ t: 'setname', name: this.username });
      this.send({ t: 'list' });
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
      this.inServer = false; this.isHost = false; this.serverName = null;
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

  setName(n) { this.username = n; this.send({ t: 'setname', name: n }); },
  refreshList() { this.send({ t: 'list' }); },
  createServer(name, password) { this.lastError = ''; this.send({ t: 'create', name: name, password: password }); },
  joinServer(name, password) { this.lastError = ''; this.send({ t: 'join', name: name, password: password }); },
  quickJoin(name) { this.lastError = ''; this.send({ t: 'quickjoin', name: name }); }, // join it, or make it
  leaveServer() { this.send({ t: 'leave' }); this.inServer = false; this.isHost = false; this.serverName = null; this._notify(); },
  setMode(mode) { if (this.isHost) this.send({ t: 'setmode', mode: mode }); },
  sendState(state) { this.send({ t: 'state', s: state }); },

  // Handle one message from the server. (Public so it can be unit-tested.)
  _handle(m) {
    switch (m.t) {
      case 'welcome': this.myId = m.id; break;
      case 'list':    this.servers = m.servers || []; break;
      case 'joined':
        this.inServer = true; this.isHost = !!m.isHost; this.serverName = m.name; this.lastError = '';
        if (m.mode && typeof onNetMode === 'function') onNetMode(m.mode);
        if (typeof onNetJoined === 'function') onNetJoined();
        break;
      case 'denied':  this.lastError = m.msg || 'Denied.'; break;
      case 'error':   this.lastError = m.msg || 'Error.'; break;
      case 'mode':    if (typeof onNetMode === 'function') onNetMode(m.mode); break;
      case 'you-are-host': this.isHost = true; break;
      case 'host':    this.isHost = (m.id === this.myId); break;
      case 'state':       if (typeof onNetState === 'function') onNetState(m.id, m.name, m.s); break;
      case 'player-left': if (typeof onNetLeft === 'function')  onNetLeft(m.id); break;
    }
    this._notify();
  },
};
