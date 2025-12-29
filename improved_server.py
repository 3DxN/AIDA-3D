import http.server
import socketserver
import os
import re
import shutil
import json
from urllib.parse import unquote

# BASE_DIR is the root of your project
BASE_DIR = os.getcwd()

class ZarrHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def end_headers(self):
        # 🛡️ ISSUE 1: Centralized CORS logic with duplicate checks
        existing = b''.join(self._headers_buffer).lower()
        
        if b'access-control-allow-origin' not in existing:
            self.send_header('Access-Control-Allow-Origin', '*')
        if b'access-control-allow-methods' not in existing:
            self.send_header('Access-Control-Allow-Methods', 'GET, OPTIONS, RANGE')
        if b'access-control-allow-headers' not in existing:
            self.send_header('Access-Control-Allow-Headers', 'Range, Content-Type')
        if b'access-control-expose-headers' not in existing:
            self.send_header('Access-Control-Expose-Headers', 'Content-Range, Content-Length')
        if b'cache-control' not in existing:
            self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
            
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # 1. API: ls (list directory)
        if '/api/ls' in self.path:
            try:
                parts = self.path.split('path=')
                rel_path = unquote(parts[1].split('&')[0]) if len(parts) > 1 else ""
                rel_path = rel_path.strip('/')
                full_path = os.path.normpath(os.path.join(BASE_DIR, rel_path.replace('/', os.sep)))
                
                folders = []
                if os.path.exists(full_path) and os.path.isdir(full_path):
                    is_current_zarr = any(os.path.exists(os.path.join(full_path, m)) for m in ['.zgroup', '.zattrs', 'zarr.json', '.zarray'])
                    
                    for entry in os.listdir(full_path):
                        if entry.startswith('.') or entry in ['node_modules', 'public', 'src', '.next', '.git', '.claude']:
                            continue
                            
                        entry_full = os.path.join(full_path, entry)
                        if os.path.isdir(entry_full):
                            # 🛡️ ISSUE 0: Context-aware label detection
                            is_zarr = any(os.path.exists(os.path.join(entry_full, m)) for m in ['.zgroup', '.zattrs', 'zarr.json', '.zarray'])
                            
                            # Check if the parent is already a 'labels' directory
                            parent_is_labels = 'labels' in rel_path.lower().split('/')[-2:] if '/' in rel_path else False
                            is_labels = entry.lower() == 'labels' or parent_is_labels or os.path.exists(os.path.join(entry_full, 'Anatomy'))
                            
                            # If it's a zarr group but inside a /labels/ path, mark it as labels
                            if is_zarr and '/labels/' in f"/{rel_path}/{entry}/":
                                is_zarr = False
                                is_labels = True

                            # If inside a Zarr image, only show the 'labels' subfolder
                            if is_current_zarr and not is_labels:
                                continue
                                
                            folders.append({
                                "name": entry,
                                "is_zarr": is_zarr,
                                "is_labels": is_labels
                            })
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"folders": sorted(folders, key=lambda x: x['name'])}).encode())
                return
            except Exception as e:
                self.send_error(500, str(e))
                return

        # 2. FILE SERVING
        url_path = unquote(self.path.split('?')[0])
        rel_path = url_path.lstrip('/')
        full_path = os.path.normpath(os.path.join(BASE_DIR, rel_path.replace('/', os.sep)))
        
        if os.path.isdir(full_path):
            for meta in ['.zgroup', '.zattrs', 'zarr.json', '.zarray']:
                if os.path.exists(os.path.join(full_path, meta)):
                    return self.serve_file(os.path.join(full_path, meta))
            return super().do_GET()
        
        if os.path.exists(full_path):
            return self.serve_file(full_path)
        
        self.send_error(404)

    def serve_file(self, path):
        try:
            file_size = os.path.getsize(path)
            ext = os.path.splitext(path)[1].lower()
            content_type = "application/json" if ext in ['.json', '.zattrs', '.zarray', '.zgroup'] else "application/octet-stream"
            
            with open(path, 'rb') as f:
                self.send_response(200)
                self.send_header('Content-Length', str(file_size))
                self.send_header('Content-Type', content_type)
                self.end_headers()
                shutil.copyfileobj(f, self.wfile)
        except Exception:
            self.send_error(500)

def run_server(port=5500):
    socketserver.TCPServer.allow_reuse_address = True
    class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
    with ThreadedServer(("0.0.0.0", port), ZarrHTTPRequestHandler) as httpd:
        print(f"🚀 STABLE SERVER: http://localhost:{port}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server(5500)
