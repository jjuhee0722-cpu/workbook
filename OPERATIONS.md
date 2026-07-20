# Workbook 운영 메모

이 저장소는 GitHub Pages에서 `index.html`로 실행되는 업무수첩입니다.

- 편집 원본: `src/index.html`
- 배포 산출물: `index.html`
- 빌드 도구: `scripts/build.mjs`

## 배포 원칙

- 운영 페이지에는 `type="text/babel"`을 넣지 않습니다.
- 운영 페이지에는 `@babel/standalone` 또는 `babel.min.js`를 넣지 않습니다.
- JSX는 배포 전에 일반 JavaScript로 미리 컴파일된 상태여야 합니다.
- `index.html`을 직접 편집하지 않습니다. 모든 기능 수정은 `src/index.html`에서 합니다.
- 배포 후에는 `https://jjuhee0722-cpu.github.io/workbook/?v=<commit>`처럼 커밋 값을 붙여 캐시를 피해 확인합니다.

## 수정 및 빌드

```bash
npm install
npm run build
python3 scripts/validate_index.py
npm run test:sync
```

`npm run build`가 `src/index.html`을 컴파일해 배포용 `index.html`을 만듭니다.

## 업로드 전 검증

저장소 루트에서 아래 명령을 실행합니다.

```bash
python3 scripts/validate_index.py
```

성공 메시지:

```text
OK: source/build structure is complete and index.html is ready for GitHub Pages.
```

## 장애 판단

- GitHub Pages가 `200 OK`인데 화면이 흰색이면 보통 데이터 손실이 아니라 앱 초기 실행 실패입니다.
- 먼저 `index.html`에 `text/babel` 또는 `@babel/standalone`이 다시 들어갔는지 확인합니다.
- 저장소의 raw `index.html`과 Pages 응답의 해시가 다르면 Pages 빌드 또는 CDN 캐시 반영 대기 상태입니다.
- GitHub Actions의 `Validate GitHub Pages build`가 실패하면 배포 전에 원본과 산출물 차이를 먼저 해결합니다.

## 동기화 먹통 대응 체크리스트

앱에서 동기화 표시가 오래 돌거나 새 항목 저장이 안 되는 것처럼 보이면 먼저 앱 사이드바의 `🩺 동기화 진단`을 확인합니다.

확인 순서:

1. `온라인`이 `예`인지 확인합니다.
2. `상태`가 `syncing`으로 10초 이상 유지되는지 확인합니다.
3. `마지막 오류`에 Supabase, Storage, RLS, 네트워크 메시지가 있는지 확인합니다.
4. `Pull 실행 중`과 `예약된 Pull`이 계속 남아 있으면 realtime 이벤트 폭주 또는 네트워크 지연 가능성이 큽니다.
5. `로컬 변경 대기`가 `있음`인데 `마지막 Push`가 갱신되지 않으면 쓰기 권한/RLS/Storage 오류를 먼저 봅니다.
6. 항목 수가 보이는데 표시만 이상하면 데이터 손실보다 UI 상태 문제일 가능성이 큽니다.

## Supabase 구조

현재 구조는 `GitHub Pages + Supabase Auth + 사용자별 row table + private Storage`입니다.

- 로그인: Supabase Auth 이메일/비밀번호
- 업무 항목: `workbook_entries`
- 분류: `workbook_categories`
- 담당자: `workbook_contacts`
- 이관 상태: `workbook_profiles`
- 기존 데이터 원본: `workbook_sync/main` 1회 이관용
- 사진/첨부: Storage bucket `workbook`, private, signed URL 사용

RLS 정책은 `auth.uid() = user_id` 기준입니다. 앱에서 Supabase schema를 바꾸기 전에는 SQL과 배포 순서를 반드시 분리합니다.

## 배포 순서

일반 코드 수정:

1. `src/index.html` 수정
2. `npm run build`
3. `python3 scripts/validate_index.py`
4. `npm run test:sync`
5. `git add src/index.html index.html ...`
6. `git commit`
7. `git push origin main`

Supabase SQL이 포함된 수정:

1. SQL migration 작성
2. Supabase SQL Editor에서 먼저 실행
3. Auth URL/RLS/Storage 정책 확인
4. 앱 코드 배포
5. 실제 로그인 후 데이터 확인
6. legacy 권한 정리 SQL 실행

주의: 새 테이블을 사용하는 앱을 SQL 적용 전에 배포하면 로그인 후 동기화 오류가 날 수 있습니다.

## 복구 기준

- 데이터가 화면에 보이면 이관/읽기는 성공한 상태입니다.
- 새 항목 추가만 실패하면 push/RLS/Storage 쪽을 먼저 확인합니다.
- 사진만 실패하면 Storage bucket `workbook` 정책과 signed URL 생성 권한을 확인합니다.
- 여러 기기에서 꼬이면 realtime 이벤트보다 최종 row 상태가 기준입니다. 항목별 `updatedAt`/`deletedAt`이 병합 기준입니다.
- 완전 롤백이 필요하면 GitHub Pages는 이전 커밋으로 되돌릴 수 있지만, Supabase schema 변경은 별도 SQL로 되돌려야 합니다.

## 보안

화면 잠금은 로컬 편의 기능이며 Supabase 접근 제어가 아닙니다. 클라우드 데이터 보호 상태와 Auth/RLS 전환 계획은 `SECURITY.md`를 확인합니다.
