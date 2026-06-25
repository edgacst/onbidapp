# onbidapp
온비드 공매정보를 공공데이터로 작업함

## 서버 배포 (Oracle Cloud 무료)

[docs/DEPLOY-ORACLE.md](docs/DEPLOY-ORACLE.md) 참고

```bash
# VM 최초 1회
sudo git clone https://github.com/edgacst/onbidapp.git /opt/onbidapp
cd /opt/onbidapp
sudo bash deploy/oracle/setup-vm.sh [도메인]

# 이후 업데이트 (PC)
npm run deploy:oracle
```
