import http.server
import socketserver
import os
import mimetypes
import re
import shutil
from urllib.parse import unquote

class ZarrHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
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
        url_path = unquote(self.path.split('?')[0])
        rel_path = url_path.lstrip('/')
        full_path = os.path.join(os.getcwd(), rel_path.replace('/', os.sep))
        
        if os.path.isdir(full_path):
            # Probe for Zarr V3/V2 metadata
            for meta in ['zarr.json', '.zattrs', '.zgroup']:
                if os.path.exists(os.path.join(full_path, meta)):
                    return self.serve_zarr_file(os.path.join(full_path, meta))
            # Otherwise serve directory listing for the explorer
            return super().do_GET()
        
        if os.path.exists(full_path):
            return self.serve_zarr_file(full_path)
        
        self.send_error(404)

    def serve_zarr_file(self, path):
        try:
            file_size = os.path.getsize(path)
            ext = os.path.splitext(path)[1].lower()
            content_type = "application/json" if ext in ['.json', '.zattrs', '.zarray'] else self.guess_type(path)
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
                        f.seek(start); self.wfile.write(f.read(length))
                        return
                self.send_response(200)
                self.send_header('Content-Length', str(file_size))
                self.send_header('Content-Type', content_type)
                self.end_headers()
                shutil.copyfileobj(f, self.wfile)
        except Exception: self.send_error(500)

def run_server(port=5500):
    socketserver.TCPServer.allow_reuse_address = True
    class ThreadedServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
        daemon_threads = True
    with ThreadedServer(("0.0.0.0", port), ZarrHTTPRequestHandler) as httpd:
        print(f"🚀 ROBUST SERVER LIVE: http://localhost:{port}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_server(5500)