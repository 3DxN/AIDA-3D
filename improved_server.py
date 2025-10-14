#!/usr/bin/env python3
"""
Improved HTTP server for serving zarr data with proper range request support
"""
import http.server
import socketserver
import os
import mimetypes
from urllib.parse import unquote
import re

class ZarrHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    """HTTP request handler with proper range request support for zarr"""
    
    def __init__(self, *args, **kwargs):
        # Add zarr-specific mime types
        mimetypes.add_type('application/json', '.zattrs')
        mimetypes.add_type('application/json', '.zarray')
        mimetypes.add_type('application/json', '.zgroup')
        mimetypes.add_type('application/octet-stream', '.zarr')
        super().__init__(*args, **kwargs)
    
    def end_headers(self):
        # Add CORS headers for all responses
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Range, Content-Type')
        self.send_header('Accept-Ranges', 'bytes')
        super().end_headers()
    
    def do_OPTIONS(self):
        """Handle preflight requests"""
        self.send_response(200)
        self.end_headers()
    
    def do_GET(self):
        """Handle GET requests with range support"""
        path = self.translate_path(self.path)
        
        if not os.path.exists(path):
            self.send_error(404, "File not found")
            return
            
        if os.path.isdir(path):
            # Serve directory listing
            super().do_GET()
            return
            
        # Handle file requests with range support
        try:
            with open(path, 'rb') as f:
                f.seek(0, 2)  # Seek to end
                file_size = f.tell()
                f.seek(0)  # Seek to beginning
                
                # Check for range request
                range_header = self.headers.get('Range')
                if range_header:
                    # Parse range header: bytes=start-end
                    range_match = re.match(r'bytes=(\d+)-(\d*)', range_header)
                    if range_match:
                        start = int(range_match.group(1))
                        end = int(range_match.group(2)) if range_match.group(2) else file_size - 1
                        
                        if start < file_size:
                            # Valid range request
                            end = min(end, file_size - 1)
                            content_length = end - start + 1
                            
                            self.send_response(206, 'Partial Content')
                            self.send_header('Content-Range', f'bytes {start}-{end}/{file_size}')
                            self.send_header('Content-Length', str(content_length))
                            self.send_header('Content-Type', self.guess_type(path))
                            self.end_headers()
                            
                            f.seek(start)
                            self.wfile.write(f.read(content_length))
                            return
                
                # Normal request (no range)
                self.send_response(200)
                self.send_header('Content-Length', str(file_size))
                self.send_header('Content-Type', self.guess_type(path))
                self.end_headers()
                
                # Send file in chunks to avoid memory issues
                while True:
                    chunk = f.read(8192)
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    
        except Exception as e:
            print(f"Error serving {path}: {e}")
            self.send_error(500, f"Internal server error: {e}")

def run_server(port=5500, directory="."):
    """Run the improved zarr server"""
    os.chdir(directory)
    
    with socketserver.TCPServer(("", port), ZarrHTTPRequestHandler) as httpd:
        print(f"Serving zarr data at http://localhost:{port}/")
        print(f"Directory: {os.getcwd()}")
        print("Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server...")

if __name__ == "__main__":
    import sys
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5500
    directory = sys.argv[2] if len(sys.argv) > 2 else "."
    run_server(port, directory)