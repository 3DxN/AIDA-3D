import http.server
import socketserver
import os
import mimetypes
import re
import shutil
import json
from urllib.parse import unquote

# BASE_DIR is the root of your project
BASE_DIR = os.getcwd()

class ZarrHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        # Enable for debugging
        # print(f"📡 {args[1]} - {args[0]}")
        pass

    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', '*')
        self.send_header('Access-Control-Allow-Headers', '*')
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate')
        super().end_headers()
    
    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # 1. API: list_labels
        if '/api/list_labels' in self.path:
            try:
                match = re.search(r'path=([^&]+)', self.path)
                z_rel = unquote(match.group(1)) if match else ""
                # Handle both leading slash and no leading slash
                z_rel = z_rel.lstrip('/')
                full_labels_path = os.path.join(BASE_DIR, z_rel.replace('/', os.sep), 'labels')
                
                folders = []
                if os.path.exists(full_labels_path):
                    folders = [f for f in os.listdir(full_labels_path) if os.path.isdir(os.path.join(full_labels_path, f))]
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"labels": folders}).encode())
                return
            except Exception: self.send_error(500); return

        # 2. FILE SERVING
        url_path = unquote(self.path.split('?')[0])
        # Strip leading slash to make it relative to BASE_DIR
        rel_path = url_path.lstrip('/')
        full_path = os.path.join(BASE_DIR, rel_path.replace('/', os.sep))
        
        # If it's a directory, check for Zarr metadata inside
        if os.path.isdir(full_path):
            for meta in ['.zgroup', '.zattrs', 'zarr.json', '.zarray']:
                meta_path = os.path.join(full_path, meta)
                if os.path.exists(meta_path):
                    return self.serve_file(meta_path)
            
            # If no Zarr metadata, let SimpleHTTPRequestHandler serve the directory listing
            return super().do_GET()
        
        # If it's a file, serve it
        if os.path.exists(full_path):
            return self.serve_file(full_path)
        
        # Not found
        self.send_error(404)

    def serve_file(self, path):
        try:
            file_size = os.path.getsize(path)
            ext = os.path.splitext(path)[1].lower()
            content_type = "application/json" if ext in ['.json', '.zattrs', '.zarray', '.zgroup'] else "application/octet-stream"
            
            with open(path, 'rb') as f:
                range_header = self.headers.get('Range')
                if range_header:
                    match = re.match(r'bytes=(\d+)-(\d*)', range_header)
                    if match:
                        start = int(match.group(1))
                        end = int(match.group(2)) if match.group(2) else file_size - 1
                        length = end - start + 1
                        self.send_response(206)
                        self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                        self.send_header('Content-Length', str(length))
                        self.send_header('Content-Type', content_type)
                        self.end_headers()
                        f.seek(start)
                        self.wfile.write(f.read(length))
                        return

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
        print(f"🚀 FINAL ROBUST SERVER: http://localhost:{port}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server(5500)
