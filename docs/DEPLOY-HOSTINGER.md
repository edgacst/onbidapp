# Hostinger 기존 VPS에 에드가공매 추가

기존 사이트가 있는 VPS에 **에드가공매만 추가**할 때 사용합니다.  
`deploy/oracle/setup-vm.sh` 는 **쓰지 마세요** — 기존 nginx 설정을 덮어쓸 수 있습니다.

## 1. 서버 상태 확인 (root@srv1757686)

```bash
free -h
df -h /
ss -tlnp | grep -E ':80|:443|:3000'
ls /etc/nginx/sites-enabled/
```

## 2. 클론 + API 키

```bash
git clone https://github.com/edgacst/onbidapp.git /opt/onbidapp
nano /opt/onbidapp/.env
```

`.env` 최소 내용:

```env
NODE_ENV=production
PORT=3000
ONBID_SERVICE_KEY=공공데이터_인코딩키
```

## 3. 기존 사이트 유지하며 설치

```bash
cd /opt/onbidapp
bash deploy/hostinger/setup-existing.sh onbid.내도메인.com 3000
```

- 도메인 DNS **A 레코드** → `187.127.107.200`
- 포트 3000이 이미 쓰이면 `3001` 등으로 변경

SSL 이메일 지정:

```bash
CERTBOT_EMAIL=freecompr20@gmail.com bash deploy/hostinger/setup-existing.sh onbid.내도메인.com 3000
```

## 4. 확인

```bash
systemctl status onbidapp
curl -s http://127.0.0.1:3000 | head
```

## 업데이트

```bash
bash /opt/onbidapp/deploy/oracle/update-app.sh
```

## 주의

| 하지 말 것 | 이유 |
|-----------|------|
| `setup-vm.sh` 실행 | default nginx 삭제, 기존 사이트 중단 |
| 포트 80을 Node가 직접 사용 | 기존 nginx와 충돌 |
