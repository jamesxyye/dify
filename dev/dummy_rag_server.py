# Simple dummy RAG SDK server with /index and /remove endpoints
# Works with both JSON payloads and multipart/form-data uploads.
# Run: python3 dev/dummy_rag_server.py

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import time

PORT = 40004


def set_cors(handler: BaseHTTPRequestHandler):
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    handler.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')


class Handler(BaseHTTPRequestHandler):
    def _send_json(self, code: int, payload: dict):
        self.send_response(code)
        set_cors(self)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode('utf-8'))

    def do_OPTIONS(self):  # noqa: N802
        self.send_response(204)
        set_cors(self)
        self.end_headers()

    def do_POST(self):  # noqa: N802
        length = int(self.headers.get('Content-Length', 0) or 0)
        raw_body = self.rfile.read(length) if length > 0 else b''
        content_type = (self.headers.get('Content-Type') or '').lower()

        if self.path == '/index':
            # Accept either JSON with {"file_path": "..."} or multipart uploads
            if 'application/json' in content_type:
                try:
                    payload = json.loads(raw_body.decode('utf-8') or '{}')
                except Exception:
                    payload = {}
                file_path = payload.get('file_path') or payload.get('path') or 'unknown'
            else:
                # multipart/form-data or other content
                file_path = 'uploaded_via_multipart'
            resp = {
                'file_path': file_path,
                'message': 'File indexed successfully',
                'processing_time_ms': int(300 + (time.time() * 1000) % 500),
                'status': 'success',
            }
            return self._send_json(200, resp)

        if self.path == '/remove':
            try:
                payload = json.loads(raw_body.decode('utf-8') or '{}')
            except Exception:
                payload = {}
            file_name = payload.get('file_name') or payload.get('file_path') or payload.get('name') or 'unknown'
            resp = {
                'removed': file_name,
                'message': 'File removed successfully',
                'processing_time_ms': int(120 + (time.time() * 1000) % 300),
                'status': 'success',
            }
            return self._send_json(200, resp)

        if self.path == '/upload':
            # Compatibility route if the frontend calls /upload; just acknowledge
            resp = {
                'bytes_received': len(raw_body),
                'message': 'File uploaded (dummy) and indexed successfully',
                'processing_time_ms': int(400 + (time.time() * 1000) % 800),
                'status': 'success',
            }
            return self._send_json(200, resp)

        return self._send_json(404, {'status': 'not_found', 'message': f'No route for {self.command} {self.path}'})


if __name__ == '__main__':
    httpd = HTTPServer(('', PORT), Handler)
    print(f'Dummy RAG SDK server listening on http://localhost:{PORT}')
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
        print('Server stopped')