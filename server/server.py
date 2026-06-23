#!/usr/bin/env python3
# ===========================================================================
#  PIXEL PLANES — ONLINE SERVER (pure Python, no installs needed)
#
#  Same job as server.js but written in Python so you don't have to install
#  anything (your Mac already has Python). It:
#    • hands out the game files (so you only need ONE address to play)
#    • keeps the public SERVER LIST, lets anyone create/join servers
#    • optional passwords; the creator is the HOST
#    • relays each plane to the others in the same server
#
#  Easiest way to run it: double-click "play.command" in the project folder.
#  Or in a terminal:   python3 server/server.py
# ===========================================================================

import socket, threading, hashlib, base64, json, os, struct

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # project folder
PORT = int(os.environ.get('PORT', '8080'))
WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif',
    '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
}

lock = threading.Lock()
servers = {}        # name -> {'name','password','host','mode','clients':{id:Conn}}
all_conns = {}      # id -> Conn
_next_id = [1]


# ---------------------------------------------------------------- WebSocket I/O
def recv_exact(sock, n):
    buf = b''
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            return None
        buf += chunk
    return buf


def read_frame(sock):
    """Return (opcode, payload_bytes) or None if the socket closed."""
    hdr = recv_exact(sock, 2)
    if not hdr:
        return None
    b1, b2 = hdr[0], hdr[1]
    opcode = b1 & 0x0F
    masked = b2 & 0x80
    length = b2 & 0x7F
    if length == 126:
        ext = recv_exact(sock, 2)
        if ext is None:
            return None
        length = struct.unpack('!H', ext)[0]
    elif length == 127:
        ext = recv_exact(sock, 8)
        if ext is None:
            return None
        length = struct.unpack('!Q', ext)[0]
    mask = b''
    if masked:
        mask = recv_exact(sock, 4)
        if mask is None:
            return None
    payload = recv_exact(sock, length) if length else b''
    if payload is None:
        return None
    if masked:
        payload = bytes(payload[i] ^ mask[i % 4] for i in range(len(payload)))
    return opcode, payload


def encode_frame(payload, opcode=0x1):
    b1 = 0x80 | opcode  # FIN + opcode
    n = len(payload)
    if n < 126:
        header = struct.pack('!BB', b1, n)
    elif n < 65536:
        header = struct.pack('!BBH', b1, 126, n)
    else:
        header = struct.pack('!BBQ', b1, 127, n)
    return header + payload


def ws_handshake(sock, headers):
    key = headers.get('sec-websocket-key', '')
    accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode()).digest()).decode()
    resp = ('HTTP/1.1 101 Switching Protocols\r\n'
            'Upgrade: websocket\r\n'
            'Connection: Upgrade\r\n'
            'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n')
    sock.sendall(resp.encode())


# ---------------------------------------------------------------- a connection
class Conn:
    def __init__(self, sock):
        self.sock = sock
        self.id = None
        self.username = 'Player'
        self.server_name = None
        self.send_lock = threading.Lock()

    def send(self, obj):
        data = json.dumps(obj).encode('utf-8')
        frame = encode_frame(data)
        with self.send_lock:
            try:
                self.sock.sendall(frame)
            except OSError:
                pass


def list_payload():
    with lock:
        return {'t': 'list', 'servers': [
            {'name': s['name'], 'hasPassword': bool(s['password']), 'players': len(s['clients'])}
            for s in servers.values()
        ]}


def broadcast_list():
    p = list_payload()
    for c in list(all_conns.values()):
        c.send(p)


def broadcast_to_server(s, obj, except_id=None):
    for cid, c in list(s['clients'].items()):
        if cid != except_id:
            c.send(obj)


def clean_name(n):
    return ''.join(ch for ch in str(n or '').upper() if ch.isalnum())[:16]


def valid_name(n):
    return bool(n) and n.isalnum() and len(n) <= 16


def leave(conn):
    with lock:
        s = servers.get(conn.server_name)
        conn.server_name = None
        if s:
            s['clients'].pop(conn.id, None)
            if conn.id == s['host']:
                # host left -> promote the next player, or close if empty
                if s['clients']:
                    new_host = next(iter(s['clients']))
                    s['host'] = new_host
                    s['clients'][new_host].send({'t': 'you-are-host'})
                    broadcast_to_server(s, {'t': 'host', 'id': new_host})
            if not s['clients']:
                servers.pop(s['name'], None)
            else:
                broadcast_to_server(s, {'t': 'player-left', 'id': conn.id})
    broadcast_list()


def handle_message(conn, m):
    t = m.get('t')
    if t == 'setname':
        conn.username = (str(m.get('name') or 'Player'))[:14] or 'Player'
    elif t == 'list':
        conn.send(list_payload())
    elif t == 'create':
        name = clean_name(m.get('name'))
        if not valid_name(name):
            return conn.send({'t': 'error', 'msg': 'Server name must be letters and numbers.'})
        with lock:
            if name in servers:
                return conn.send({'t': 'denied', 'reason': 'name', 'msg': 'That server name is taken.'})
            s = {'name': name, 'password': str(m.get('password') or ''),
                 'host': conn.id, 'mode': 'classic', 'clients': {conn.id: conn}}
            servers[name] = s
            conn.server_name = name
        conn.send({'t': 'joined', 'name': name, 'isHost': True, 'mode': 'classic'})
        broadcast_list()
    elif t == 'join':
        name = clean_name(m.get('name'))
        with lock:
            s = servers.get(name)
            if not s:
                return conn.send({'t': 'denied', 'reason': 'missing', 'msg': 'No server with that name.'})
            if s['password'] and str(m.get('password') or '') != s['password']:
                return conn.send({'t': 'denied', 'reason': 'password', 'msg': 'Wrong password.'})
            s['clients'][conn.id] = conn
            conn.server_name = name
            is_host = (conn.id == s['host'])
            mode = s['mode']
            broadcast_to_server(s, {'t': 'player-joined', 'id': conn.id, 'name': conn.username}, conn.id)
        conn.send({'t': 'joined', 'name': name, 'isHost': is_host, 'mode': mode})
        broadcast_list()
    elif t == 'leave':
        leave(conn)
    elif t == 'setmode':
        with lock:
            s = servers.get(conn.server_name)
            if s and conn.id == s['host']:
                s['mode'] = m.get('mode')
                broadcast_to_server(s, {'t': 'mode', 'mode': m.get('mode')}, conn.id)
    elif t == 'state':
        with lock:
            s = servers.get(conn.server_name)
            if s:
                broadcast_to_server(s, {'t': 'state', 'id': conn.id, 'name': conn.username, 's': m.get('s')}, conn.id)


def handle_ws(sock):
    conn = Conn(sock)
    with lock:
        conn.id = _next_id[0]
        _next_id[0] += 1
        all_conns[conn.id] = conn
    print('player %d connected (%d online)' % (conn.id, len(all_conns)))
    conn.send({'t': 'welcome', 'id': conn.id})
    conn.send(list_payload())
    try:
        while True:
            frame = read_frame(sock)
            if frame is None:
                break
            opcode, payload = frame
            if opcode == 0x8:          # close
                break
            if opcode == 0x9:          # ping -> pong
                with conn.send_lock:
                    try: sock.sendall(encode_frame(payload, 0xA))
                    except OSError: break
                continue
            if opcode != 0x1:          # we only use text frames
                continue
            try:
                m = json.loads(payload.decode('utf-8'))
            except Exception:
                continue
            handle_message(conn, m)
    finally:
        with lock:
            all_conns.pop(conn.id, None)
        leave(conn)
        print('player %d left (%d online)' % (conn.id, len(all_conns)))


# ---------------------------------------------------------------- static files
def serve_file(sock, request_line):
    try:
        path = request_line.split(' ')[1].split('?')[0]
    except Exception:
        path = '/'
    if path == '/' or path == '':
        path = '/index.html'
    from urllib.parse import unquote
    path = unquote(path)
    file_path = os.path.normpath(os.path.join(ROOT, path.lstrip('/')))
    if not file_path.startswith(ROOT) or not os.path.isfile(file_path):
        sock.sendall(b'HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\n\r\nNot found')
        return
    with open(file_path, 'rb') as f:
        body = f.read()
    ext = os.path.splitext(file_path)[1].lower()
    ctype = MIME.get(ext, 'application/octet-stream')
    head = ('HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %d\r\n'
            'Cache-Control: no-cache\r\nConnection: close\r\n\r\n' % (ctype, len(body)))
    sock.sendall(head.encode() + body)


def read_http_head(sock):
    data = b''
    while b'\r\n\r\n' not in data:
        chunk = sock.recv(2048)
        if not chunk:
            return None, {}
        data += chunk
        if len(data) > 65536:
            break
    head = data.split(b'\r\n\r\n', 1)[0].decode('latin1')
    lines = head.split('\r\n')
    headers = {}
    for line in lines[1:]:
        if ':' in line:
            k, v = line.split(':', 1)
            headers[k.strip().lower()] = v.strip()
    return (lines[0] if lines else ''), headers


def handle_conn(sock):
    try:
        request_line, headers = read_http_head(sock)
        if not request_line:
            sock.close(); return
        if headers.get('upgrade', '').lower() == 'websocket':
            ws_handshake(sock, headers)
            handle_ws(sock)
        else:
            serve_file(sock, request_line)
            sock.close()
    except Exception:
        try: sock.close()
        except Exception: pass


def lan_ips():
    ips = []
    try:
        host = socket.gethostname()
        for info in socket.getaddrinfo(host, None):
            ip = info[4][0]
            if '.' in ip and not ip.startswith('127.') and ip not in ips:
                ips.append(ip)
    except Exception:
        pass
    return ips


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(('0.0.0.0', PORT))
    srv.listen(50)
    print('================================================================')
    print(' Pixel Planes is RUNNING! Open one of these in a browser:')
    print('   - on THIS computer:  http://localhost:%d' % PORT)
    for ip in lan_ips():
        print('   - others on WiFi:    http://%s:%d' % (ip, PORT))
    print(' Everyone who opens it can press ESC -> Create / Join a server.')
    print(' Keep this window open while you play. Press Ctrl+C to stop.')
    print('================================================================')
    try:
        while True:
            sock, addr = srv.accept()
            threading.Thread(target=handle_conn, args=(sock,), daemon=True).start()
    except KeyboardInterrupt:
        print('\nStopped. Bye!')
    finally:
        srv.close()


if __name__ == '__main__':
    main()
