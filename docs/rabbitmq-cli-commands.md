# RabbitMQ CLI 명령어 모음

## 기본 설정

모든 명령어는 Docker 컨테이너 내부에서 실행하며, 인증 정보가 필요합니다:

```bash
# 기본 형식
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! [command]
```

## 큐 관리

### 큐 목록 조회
```bash
# 모든 큐 확인
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list queues

# 큐 이름과 메시지 개수만 확인
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list queues name messages

# 상세 정보 포함
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list queues name messages consumers
```

### 특정 큐 정보 확인
```bash
# dlq_queue 상세 정보
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! show queue name=dlq_queue
```

### 메시지 조회 (컨슈밍 안 함)
```bash
# DLQ 메시지 최대 5개 확인 (메시지는 큐에 남음)
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! get queue=dlq_queue count=5

# 메시지 1개만 확인
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! get queue=dlq_queue count=1
```

### 메시지 조회 및 제거
```bash
# DLQ 메시지 1개 가져오기 (큐에서 제거됨)
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! get queue=dlq_queue count=1 ackmode=ack_requeue_false
```

### 큐 비우기
```bash
# DLQ 모든 메시지 삭제
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! purge queue name=dlq_queue
```

### 큐 삭제
```bash
# DLQ 큐 삭제
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! delete queue name=dlq_queue
```

## Exchange 관리

### Exchange 목록 조회
```bash
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list exchanges
```

### Exchange 상세 정보
```bash
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! show exchange name=dlq_exchange
```

## Binding 관리

### Binding 목록 확인
```bash
# 모든 바인딩 확인
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list bindings

# 특정 큐의 바인딩 확인
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list bindings | grep dlq_queue
```

## Connection & Channel 관리

### 현재 연결 확인
```bash
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list connections
```

### 현재 채널 확인
```bash
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list channels
```

## 메시지 발행

### 테스트 메시지 발행
```bash
# dlq_exchange로 직접 발행 (테스트용)
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! publish \
  exchange=dlq_exchange \
  routing_key=dlq.orders \
  payload='{"test":"message"}'
```

## 모니터링

### 전체 상태 확인
```bash
# 노드 상태
docker exec rabbitmq-node1 rabbitmqctl status

# 클러스터 상태
docker exec rabbitmq-node1 rabbitmqctl cluster_status
```

### 메모리 사용량
```bash
docker exec rabbitmq-node1 rabbitmqctl list_queues name memory
```

## 유용한 조합

### DLQ 모니터링 스크립트
```bash
#!/bin/bash
# dlq-monitor.sh

while true; do
  echo "=== DLQ 상태 ($(date)) ==="
  docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list queues name messages | grep dlq_queue
  sleep 10
done
```

### 실패 메시지 백업
```bash
# DLQ 메시지를 JSON 파일로 저장
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! get queue=dlq_queue count=100 > dlq-backup-$(date +%Y%m%d-%H%M%S).json
```

## Management UI 접속

브라우저에서 더 편리한 UI로 관리 가능:

```
URL: http://localhost:15672
Username: admin
Password: SecurePassword123!
```

## 자주 사용하는 명령어 별칭

`.bashrc` 또는 `.zshrc`에 추가:

```bash
# RabbitMQ 명령어 별칭
alias rmq-queues='docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! list queues name messages'
alias rmq-dlq='docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! get queue=dlq_queue count=5'
alias rmq-purge-dlq='docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! purge queue name=dlq_queue'
```

사용 예:
```bash
rmq-queues        # 큐 목록 확인
rmq-dlq           # DLQ 메시지 확인
rmq-purge-dlq     # DLQ 비우기
```
