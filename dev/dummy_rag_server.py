# Simple dummy RAG SDK server with pipeline endpoints
# Run: python3 dev/dummy_rag_server.py

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import time
import os
from datetime import datetime
from urllib.parse import urlparse, parse_qs

PORT = 40005
LOG_FILE = os.path.join(os.path.dirname(__file__), 'server.log')

# In-memory pipelines store: { name: {"config": {...}, "files": set([...]) } }
PIPELINES: dict[str, dict] = {}


def set_cors(handler: BaseHTTPRequestHandler):
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
    handler.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')


def log_json_body(path: str, raw_body: bytes):
    try:
        text = (raw_body or b'').decode('utf-8', errors='replace').strip()
    except Exception:
        text = ''
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(f"{datetime.utcnow().isoformat()}Z {path} {text}\n")
    except Exception:
        # Fail silently if logging fails
        pass


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

        # Log JSON request bodies for relevant endpoints
        if self.path in ('/create_pipeline', '/index', '/remove_file', '/remove_pipeline', '/list_files') and 'application/json' in content_type:
            log_json_body(self.path, raw_body)

        # Parse JSON payload if present
        try:
            payload = json.loads(raw_body.decode('utf-8') or '{}') if 'application/json' in content_type else {}
        except Exception:
            payload = {}

        # 1. Create Pipeline
        if self.path == '/create_pipeline':
            name = (payload.get('pipeline_name') or '').strip()
            config = payload.get('config') or {}
            if not name:
                return self._send_json(400, {'status': 'error', 'message': 'pipeline_name is required'})
            # Initialize or overwrite config
            entry = PIPELINES.get(name) or {'config': {}, 'files': set()}
            entry['config'] = config if isinstance(config, dict) else {}
            entry['files'] = set(entry.get('files') or [])
            PIPELINES[name] = entry
            # Simulate processing time
            delay_ms = int(2000 + (time.time() * 1000) % 700)
            time.sleep(delay_ms / 1000.0)
            return self._send_json(200, {
                'status': 'success',
                'message': 'Pipeline created successfully',
                'pipeline_name': name,
                'processing_time_ms': delay_ms,
            })

        # 2. Index File into a pipeline
        if self.path == '/index':
            pipeline_name = (payload.get('pipeline_name') or '').strip()
            file_path = payload.get('file_path') or payload.get('path')
            if not pipeline_name:
                return self._send_json(400, {'status': 'error', 'message': 'pipeline_name is required'})
            if not file_path:
                return self._send_json(400, {'status': 'error', 'message': 'file_path is required'})
            if pipeline_name not in PIPELINES:
                # auto-create empty pipeline for convenience in mock
                PIPELINES[pipeline_name] = {'config': {}, 'files': set()}

            # Fixed delay for predictable testing
            delay_sec = 0.123
            time.sleep(delay_sec)
            PIPELINES[pipeline_name]['files'].add(str(file_path))
            resp = {
                'pipeline_name': pipeline_name,
                'file_path': file_path,
                'message': 'File indexed successfully',
                'processing_time_ms': int(delay_sec * 1000),
                'status': 'success',
            }
            return self._send_json(200, resp)

        # 4. Remove File from a pipeline
        if self.path == '/remove_file':
            pipeline_name = (payload.get('pipeline_name') or '').strip()
            file_path = payload.get('file_path') or payload.get('name')
            if not pipeline_name:
                return self._send_json(400, {'status': 'error', 'message': 'pipeline_name is required'})
            if not file_path:
                return self._send_json(400, {'status': 'error', 'message': 'file_path is required'})
            if pipeline_name not in PIPELINES:
                return self._send_json(404, {'status': 'error', 'message': f'pipeline {pipeline_name} not found'})
            PIPELINES[pipeline_name]['files'].discard(str(file_path))
            resp = {
                'pipeline_name': pipeline_name,
                'removed': file_path,
                'message': 'File removed successfully',
                'status': 'success',
            }
            return self._send_json(200, resp)

        # 5. Remove Pipeline
        if self.path == '/remove_pipeline':
            pipeline_name = (payload.get('pipeline_name') or '').strip()
            if not pipeline_name:
                return self._send_json(400, {'status': 'error', 'message': 'pipeline_name is required'})
            existed = PIPELINES.pop(pipeline_name, None)
            if not existed:
                return self._send_json(404, {'status': 'error', 'message': f'pipeline {pipeline_name} not found'})
            return self._send_json(200, {'status': 'success', 'pipeline_name': pipeline_name, 'message': 'Pipeline removed'})

        # 6b. List Files (POST body alternative)
        if self.path == '/list_files':
            pipeline_name = (payload.get('pipeline_name') or '').strip()
            if not pipeline_name:
                return self._send_json(400, {'status': 'error', 'message': 'pipeline_name is required'})
            entry = PIPELINES.get(pipeline_name)
            files = sorted(list(entry['files'])) if entry else []
            return self._send_json(200, {
                'status': 'success',
                'pipeline_name': pipeline_name,
                'file_count': len(files),
                'files': files,
            })

        # Back-compat legacy routes (optional): /remove
        if self.path == '/remove':
            try:
                file_name = payload.get('file_name') or payload.get('file_path') or payload.get('name') or 'unknown'
            except Exception:
                file_name = 'unknown'
            return self._send_json(200, {
                'removed': file_name,
                'message': 'File removed successfully (legacy)',
                'status': 'success',
            })

        # Unknown POST route
        return self._send_json(404, {'status': 'not_found', 'message': f'No route for {self.command} {self.path}'})

    def do_GET(self):  # noqa: N802
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)

        # 6a. List Files via GET with query param
        if path == '/list_files':
            pipeline_name = (query.get('pipeline_name', [''])[0] or '').strip()
            if not pipeline_name:
                return self._send_json(400, {'status': 'error', 'message': 'pipeline_name is required'})
            entry = PIPELINES.get(pipeline_name)
            files = sorted(list(entry['files'])) if entry else []
            return self._send_json(200, {
                'status': 'success',
                'pipeline_name': pipeline_name,
                'file_count': len(files),
                'files': files,
            })

        # 7. List Pipelines
        if path == '/list_pipelines':
            pipelines = []
            for name, entry in PIPELINES.items():
                pipelines.append({
                    'name': name,
                    'config': entry.get('config', {}),
                    'n_gpu': 1,
                    'path': f'rag_data/pipelines/{name}',
                })
            return self._send_json(200, {
                'status': 'success',
                'pipeline_count': len(pipelines),
                'pipelines': pipelines,
            })

        # Unknown GET route
        self.send_response(404)
        set_cors(self)
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'status': 'not_found', 'message': f'No route for {self.command} {self.path}'}).encode('utf-8'))


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