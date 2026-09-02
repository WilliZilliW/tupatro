import http.server, socketserver
class H(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        t = super().guess_type(path)
        return t + "; charset=utf-8" if t and t.startswith("text/") else t
socketserver.TCPServer.allow_reuse_address = True
socketserver.TCPServer(("", 8732), H).serve_forever()
