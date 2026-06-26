// ===========================================================================
//  VOICE  --  live voice chat over WebRTC (players talk + hear each other).
//
//  How it works: when you turn your mic on we grab your microphone, then make a
//  direct audio connection to every other voice-on player (a "mesh"). The game
//  server only passes the tiny setup messages (who's here, connection offers);
//  the actual voice goes peer-to-peer.
//
//  To avoid both sides calling at once ("glare"), the player with the SMALLER id
//  always makes the offer.
// ===========================================================================

const Voice = {
  on: false,
  localStream: null,
  peers: {},                 // id -> RTCPeerConnection
  cfg: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },

  myId() { return (typeof Net !== 'undefined') ? Net.myId : null; },

  // Turn the mic ON: ask permission, then announce so others connect to us.
  async enable() {
    if (this.on) return true;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Voice chat is not supported in this browser/page.');
      return false;
    }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    } catch (e) {
      alert('Could not use your microphone (' + (e && e.name ? e.name : 'blocked') + ').');
      return false;
    }
    this.on = true;
    if (typeof Net !== 'undefined' && Net.sendVoiceHello) Net.sendVoiceHello();  // broadcast "I'm on"
    return true;
  },

  // Turn the mic OFF: stop the mic and close all the voice connections.
  disable() {
    this.on = false;
    if (this.localStream) { this.localStream.getTracks().forEach((t) => t.stop()); this.localStream = null; }
    for (const id in this.peers) this._close(id);
    if (typeof Net !== 'undefined' && Net.sendVoiceBye) Net.sendVoiceBye();
  },

  // Another player announced they're voice-on.
  onHello(from) {
    if (!this.on) return;
    const me = this.myId();
    if (me == null) return;
    if (me < from) this._connect(from, true);                  // I'm lower -> I make the offer
    else if (Net.sendVoiceHello) Net.sendVoiceHello(from);     // I'm higher -> nudge THEM to offer me
  },

  // A WebRTC setup message (offer/answer/ice) arrived from another player.
  onSignal(from, payload) {
    let pc = this.peers[from];
    if (!pc) { if (!this.on) return; this._connect(from, false); pc = this.peers[from]; }
    if (payload.sdp) {
      pc.setRemoteDescription(payload.sdp).then(() => {
        if (payload.sdp.type === 'offer') {
          return pc.createAnswer()
            .then((a) => pc.setLocalDescription(a))
            .then(() => Net.sendRtc(from, { sdp: pc.localDescription }));
        }
      }).catch(() => {});
    } else if (payload.ice) {
      pc.addIceCandidate(payload.ice).catch(() => {});
    }
  },

  onBye(from) { this._close(from); },     // they turned voice off / left

  _connect(id, initiator) {
    if (this.peers[id]) return;
    const pc = new RTCPeerConnection(this.cfg);
    this.peers[id] = pc;
    if (this.localStream) this.localStream.getTracks().forEach((t) => pc.addTrack(t, this.localStream));
    pc.onicecandidate = (e) => { if (e.candidate) Net.sendRtc(id, { ice: e.candidate }); };
    pc.ontrack = (e) => this._play(id, e.streams[0]);
    if (initiator) {
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .then(() => Net.sendRtc(id, { sdp: pc.localDescription }))
        .catch(() => {});
    }
  },

  // Play an incoming voice stream (one hidden <audio> per other player).
  // Phones/Safari often BLOCK auto-play, which causes "I can't hear them" one
  // way -- so we set the right flags AND call play() explicitly.
  _play(id, stream) {
    let a = document.getElementById('va-' + id);
    if (!a) {
      a = document.createElement('audio');
      a.id = 'va-' + id;
      a.autoplay = true;
      a.setAttribute('playsinline', '');   // iOS needs this to play inline
      document.body.appendChild(a);
    }
    a.srcObject = stream;
    a.muted = false;
    const p = a.play(); if (p && p.catch) p.catch(() => {});   // start it now (gesture already happened)
  },

  // If a browser blocked auto-play, the next tap/click re-tries every voice.
  unlockAll() {
    document.querySelectorAll('audio[id^="va-"]').forEach((a) => {
      a.muted = false; const p = a.play(); if (p && p.catch) p.catch(() => {});
    });
  },

  _close(id) {
    const pc = this.peers[id];
    if (pc) { try { pc.close(); } catch (e) {} delete this.peers[id]; }
    const a = document.getElementById('va-' + id); if (a) a.remove();
  },
};

// Any tap/click re-tries playing incoming voices (in case auto-play was blocked).
['pointerdown', 'touchend', 'click'].forEach((ev) =>
  window.addEventListener(ev, () => Voice.unlockAll(), { passive: true }));
