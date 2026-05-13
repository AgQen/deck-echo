# DECK-ECHO 로컬 정적 서버.
# Python 표준 라이브러리만 사용. start.bat / start.ps1 에서 호출됨.
import http.server
import socket
import socketserver
import sys
import os

PORT = 8000

def candidate_ips():
    ips = set()
    try:
        host = socket.gethostname()
        for entry in socket.getaddrinfo(host, None):
            ip = entry[4][0]
            if ":" in ip:
                continue
            ips.add(ip)
    except Exception:
        pass
    # UDP 트릭으로 outbound IP 도 알아냄
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ips.add(s.getsockname()[0])
        s.close()
    except Exception:
        pass
    return sorted(i for i in ips if not i.startswith("127.") and not i.startswith("169.254."))

def main():
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    print()
    print("=== DECK-ECHO 로컬 서버 ===")
    print()
    ips = candidate_ips()
    if ips:
        print("핸드폰 브라우저에서 아래 주소 중 하나로 접속:")
        for ip in ips:
            print(f"   http://{ip}:{PORT}")
    else:
        print("[알림] 외부 IP를 자동 감지하지 못했습니다. 명령 프롬프트에서")
        print("       'ipconfig' 입력 후 IPv4 주소 옆 숫자를 사용하세요.")
    print(f"   http://localhost:{PORT}   (이 PC 전용)")
    print()
    print("처음 실행 시 Windows 방화벽 창이 뜨면 '개인 네트워크 허용' 을 누르세요.")
    print("종료하려면 이 창에서 Ctrl+C")
    print()

    Handler = http.server.SimpleHTTPRequestHandler
    # 개발용 캐시 전략: must-revalidate. 변경 시는 항상 새 파일, 미변경 시 304로 빠르게.
    class DevCache(Handler):
        def end_headers(self):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
            super().end_headers()

    try:
        with socketserver.TCPServer(("0.0.0.0", PORT), DevCache) as httpd:
            httpd.allow_reuse_address = True
            httpd.serve_forever()
    except OSError as e:
        print(f"[에러] 포트 {PORT} 사용 불가: {e}")
        print("       다른 프로그램이 8000번 포트를 쓰는 중일 수 있습니다.")
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n서버 종료.")

if __name__ == "__main__":
    main()
