# DLQ 설정 가이드

## 환경 변수 설정

`.env` 파일에서 DLQ 동작 방식을 제어할 수 있습니다.

```env
# RabbitMQ 연결 URL
RMQ_URL='amqp://admin:SecurePassword123!@localhost:5672'

# DLQ 모드 설정
# auto: DLQ 자동 처리 (consumer 활성화)
# monitor: 모니터링 전용 (consumer 비활성화 + DLQMonitorService 활성화)
# off: 모두 비활성화
DLQ_MODE=monitor
```

## DLQ_MODE 옵션

### `auto` - 자동 처리 모드 (개발 환경 권장)

```env
DLQ_MODE=auto
```

**동작 방식**:
- DLQ 컨슈머 활성화
- `@EventPattern('dlq.orders')` 핸들러가 즉시 실행
- 실시간 로깅 및 알림 가능
- DLQMonitorService 비활성화

**장점**:
- ✅ 즉각적인 피드백
- ✅ 개발 중 편리한 디버깅
- ✅ 실시간 에러 추적

**단점**:
- ⚠️ 패턴 변환 로직 필요 (workaround)
- ⚠️ 확장성 제한 (새 이벤트마다 수정 필요)

**적합한 환경**: 개발, 테스트, 프로토타입

### `monitor` - 모니터링 전용 모드 (프로덕션 권장)

```env
DLQ_MODE=monitor
```

**동작 방식**:
- DLQ 컨슈머 비활성화
- 실패한 메시지는 DLQ에 저장만 됨
- DLQMonitorService 활성화 (1분마다 큐 확인)
- RabbitMQ Management UI나 CLI로 수동 확인 가능

**장점**:
- ✅ 안전하고 예측 가능
- ✅ 무한 루프 위험 없음
- ✅ 메시지 손실 방지
- ✅ 주기적 모니터링 및 로그 출력

**단점**:
- ❌ 수동 개입 필요

**적합한 환경**: 프로덕션, 스테이징

### `off` - 비활성화 모드

```env
DLQ_MODE=off
```

**동작 방식**:
- DLQ 컨슈머 비활성화
- DLQMonitorService 비활성화
- DLQ 큐는 여전히 생성되지만 모니터링 없음

**적합한 환경**: DLQ 기능이 필요 없는 환경

## 권장 설정

### 개발 환경 (Development)

```env
DLQ_MODE=auto
```

**이유**: 자동 처리로 즉각적인 피드백

### 테스트 환경 (Testing)

```env
DLQ_MODE=auto
```

**이유**: 자동 처리로 완벽한 추적

### 스테이징 환경 (Staging)

```env
DLQ_MODE=monitor
```

**이유**: 프로덕션과 동일한 모니터링 전용 모드

### 프로덕션 환경 (Production)

```env
DLQ_MODE=monitor
```

**이유**: 안전한 모니터링 전용 + 주기적 알림으로 실패 감지

## 동작 확인

### 서버 시작 로그 확인

```bash
npm run start:dev
```

**모니터링 전용 모드 (`monitor`) 활성화 시**:
```
[RabbitMQConsumerService] 📋 DLQ 모드: monitor
[DLQMonitorService] ✅ DLQ 모니터링 서비스 활성화 - 1분마다 확인
```

**자동 처리 모드 (`auto`) 활성화 시**:
```
[RabbitMQConsumerService] 📋 DLQ 모드: auto
```

## DLQ 수동 관리 API

DLQ 메시지를 수동으로 조회, 재처리, 삭제할 수 있는 REST API를 제공합니다.

### API 엔드포인트

#### 1. DLQ 상태 조회
```bash
GET http://localhost:3000/dlq/status
```

**응답 예시**:
```json
{
  "queueName": "dlq_queue",
  "messageCount": 5,
  "consumerCount": 0
}
```

#### 2. DLQ 메시지 목록 조회
```bash
GET http://localhost:3000/dlq/messages?limit=10
```

**응답 예시**:
```json
[
  {
    "messageId": "msg-0",
    "routingKey": "dlq.orders",
    "payload": {
      "orderId": "7cafda00-0591-4b86-8dd6-0d9592cd4565",
      "userId": "test_user",
      "products": [...]
    },
    "headers": { "x-death": [...] },
    "retryCount": 1,
    "failureReason": "delivery_limit",
    "originalQueue": "orders_queue",
    "timestamp": 1759484540
  }
]
```

#### 3. orderId로 특정 메시지 조회
```bash
GET http://localhost:3000/dlq/messages/:orderId
```

**예시**:
```bash
GET http://localhost:3000/dlq/messages/7cafda00-0591-4b86-8dd6-0d9592cd4565
```

#### 4. orderId로 메시지 재처리
```bash
POST http://localhost:3000/dlq/messages/:orderId/reprocess
```

**동작**: 해당 메시지를 원본 큐(`orders_queue`)로 재발행하고 DLQ에서 제거

**응답**:
```json
{
  "success": true
}
```

#### 5. orderId로 메시지 삭제
```bash
DELETE http://localhost:3000/dlq/messages/:orderId
```

**동작**: 해당 메시지를 DLQ에서 영구 삭제

#### 6. 모든 메시지 일괄 재처리
```bash
POST http://localhost:3000/dlq/reprocess-all
```

**응답**:
```json
{
  "reprocessedCount": 5
}
```

#### 7. 모든 메시지 삭제 (purge)
```bash
DELETE http://localhost:3000/dlq/purge
```

**응답**:
```json
{
  "deletedCount": 5
}
```

## RabbitMQ Management UI 사용

```
http://localhost:15672
Username: admin
Password: SecurePassword123!
```

1. **Queues** 탭 클릭
2. **dlq_queue** 선택
3. **Get messages** 버튼으로 메시지 확인

## CLI 명령어

```bash
# DLQ 메시지 개수 확인
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! \
  list queues name messages

# DLQ 메시지 조회 (5개)
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! \
  get queue=dlq_queue count=5

# DLQ 비우기
docker exec rabbitmq-node1 rabbitmqadmin -u admin -p SecurePassword123! \
  purge queue name=dlq_queue
```

더 많은 CLI 명령어는 [rabbitmq-cli-commands.md](./rabbitmq-cli-commands.md)를 참고하세요.

## 문제 해결

### DLQ 핸들러가 호출되지 않음

**증상**: `DLQ_MODE=auto`인데 DLQ 로그가 안 나옴

**해결**:
1. 서버 재시작 확인
2. `.env` 파일 저장 확인
3. 로그에서 "DLQ 모드: auto" 확인

### DLQ 모니터링이 작동하지 않음

**증상**: `DLQ_MODE=monitor`인데 모니터링 로그가 안 나옴

**해결**:
1. `@nestjs/schedule` 패키지 설치 확인: `npm list @nestjs/schedule`
2. `ScheduleModule.forRoot()` 등록 확인 (app.module.ts)
3. RabbitMQ 연결 확인

### 모니터링 서비스 에러

**증상**: "DLQ 모니터링 초기화 실패"

**해결**:
1. RabbitMQ 서버 실행 확인: `docker ps | grep rabbitmq`
2. `RMQ_URL` 환경 변수 확인
3. RabbitMQ 연결 권한 확인
