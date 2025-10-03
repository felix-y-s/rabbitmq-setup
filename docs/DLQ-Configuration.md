# DLQ 설정 가이드

## 환경 변수 설정

`.env` 파일에서 DLQ 동작 방식을 제어할 수 있습니다.

```env
# RabbitMQ 연결 URL
RMQ_URL='amqp://admin:SecurePassword123!@localhost:5672'

# DLQ 모드 설정
USE_MONITORING_ONLY_DLQ=false  # DLQ 처리 방식 선택
ENABLE_DLQ_MONITOR=false       # DLQ 모니터링 서비스 활성화
```

## 설정 옵션

### 1. USE_MONITORING_ONLY_DLQ

DLQ 메시지를 자동으로 처리할지 여부를 결정합니다.

#### `false` - 자동 처리 모드 (기본값, 개발 환경 권장)

```env
USE_MONITORING_ONLY_DLQ=false
```

**동작 방식**:
- DLQ 메시지를 자동으로 컨슈밍
- `@EventPattern('dlq.orders')` 핸들러가 즉시 실행
- 실시간 로깅 및 알림 가능

**장점**:
- ✅ 즉각적인 피드백
- ✅ 개발 중 편리한 디버깅
- ✅ 실시간 에러 추적

**단점**:
- ⚠️ 패턴 변환 로직 필요 (workaround)
- ⚠️ 확장성 제한 (새 이벤트마다 수정 필요)

**적합한 환경**: 개발, 테스트, 프로토타입

#### `true` - 모니터링 전용 모드 (프로덕션 권장)

```env
USE_MONITORING_ONLY_DLQ=true
```

**동작 방식**:
- DLQ 컨슈머가 생성되지 않음
- 실패한 메시지는 DLQ에 저장만 됨
- RabbitMQ Management UI나 CLI로 수동 확인

**장점**:
- ✅ 안전하고 예측 가능
- ✅ 무한 루프 위험 없음
- ✅ 메시지 손실 방지

**단점**:
- ❌ 자동 알림 없음 (별도 모니터링 필요)
- ❌ 수동 개입 필요

**적합한 환경**: 프로덕션, 스테이징

### 2. ENABLE_DLQ_MONITOR

DLQ 모니터링 서비스 활성화 여부를 결정합니다.

#### `false` - 모니터링 비활성화 (기본값)

```env
ENABLE_DLQ_MONITOR=false
```

**동작 방식**:
- DLQMonitorService가 초기화되지 않음
- Cron 작업 실행 안 됨

#### `true` - 모니터링 활성화

```env
ENABLE_DLQ_MONITOR=true
```

**동작 방식**:
- DLQMonitorService가 초기화됨
- 1분마다 DLQ 큐를 확인
- 메시지 발견 시 로그 출력 (TODO: Slack/Email 알림)

**사용 시나리오**:
- 모니터링 전용 DLQ 모드에서 알림 필요 시
- 프로덕션 환경에서 DLQ 상태 추적

## 권장 설정 조합

### 개발 환경 (Development)

```env
USE_MONITORING_ONLY_DLQ=false
ENABLE_DLQ_MONITOR=false
```

**이유**: 자동 처리로 즉각적인 피드백, 모니터링 서비스는 불필요

### 테스트 환경 (Testing)

```env
USE_MONITORING_ONLY_DLQ=false
ENABLE_DLQ_MONITOR=true
```

**이유**: 자동 처리 + 주기적 모니터링으로 완벽한 추적

### 스테이징 환경 (Staging)

```env
USE_MONITORING_ONLY_DLQ=true
ENABLE_DLQ_MONITOR=true
```

**이유**: 프로덕션과 동일한 모니터링 전용 모드 + 알림

### 프로덕션 환경 (Production)

```env
USE_MONITORING_ONLY_DLQ=true
ENABLE_DLQ_MONITOR=true
```

**이유**: 안전한 모니터링 전용 + 알림으로 실패 감지

## 동작 확인

### 서버 시작 로그 확인

```bash
npm run start:dev
```

**모니터링 전용 모드 활성화 시**:
```
[RabbitMQConsumerService] 📋 DLQ 모드: 모니터링 전용
[DLQMonitorService] ✅ DLQ 모니터링 서비스 활성화 - 1분마다 확인
```

**자동 처리 모드 활성화 시**:
```
[RabbitMQConsumerService] 📋 DLQ 모드: 자동 처리
[DLQMonitorService] ❌ DLQ 모니터링 비활성화 (ENABLE_DLQ_MONITOR=false)
```

## 수동 DLQ 관리

모니터링 전용 모드에서는 다음 방법으로 DLQ를 관리합니다:

### RabbitMQ Management UI

```
http://localhost:15672
Username: admin
Password: SecurePassword123!
```

1. **Queues** 탭 클릭
2. **dlq_queue** 선택
3. **Get messages** 버튼으로 메시지 확인

### CLI 명령어

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

**증상**: `USE_MONITORING_ONLY_DLQ=false`인데 DLQ 로그가 안 나옴

**해결**:
1. 서버 재시작 확인
2. `.env` 파일 저장 확인
3. 로그에서 "DLQ 모드: 자동 처리" 확인

### DLQ 모니터링이 작동하지 않음

**증상**: `ENABLE_DLQ_MONITOR=true`인데 모니터링 로그가 안 나옴

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
