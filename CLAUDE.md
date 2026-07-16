# 업무수첩 프로젝트

React + Supabase 기반 업무 관리 앱. JSX 원본을 빌드해 단일 `index.html`로 GitHub Pages에 배포한다.

## 배포 정보

- GitHub 저장소: `jjuhee0722-cpu/workbook`
- Pages URL: `https://jjuhee0722-cpu.github.io/workbook/`
- 작업 파일: `src/index.html`
- 배포 파일: `index.html` (`npm run build`로 생성)

## 기술 스택

- React 18 UMD + Babel 사전 컴파일
- IndexedDB — 로그인 사용자별 로컬 캐시
- Supabase Auth — 이메일/비밀번호 로그인
- Supabase Postgres + RLS — 사용자별 행 단위 동기화
- Supabase Storage — 사진/첨부 private bucket 저장, signed URL 표시
- SheetJS — 엑셀 내보내기

## Supabase

- URL: `https://qroxbykatxpqvvgaftom.supabase.co`
- 신규 테이블:
  - `workbook_profiles`
  - `workbook_entries`
  - `workbook_categories`
  - `workbook_contacts`
- 기존 테이블:
  - `workbook_sync` / `id=main`
  - 첫 로그인 때 신규 테이블로 1회 이관하는 legacy source
- Storage bucket: `workbook` (private)
- anon key: `src/index.html`의 `SB_KEY` 변수에 있음. 공개 키라 노출 자체는 정상이며, 실제 접근 제어는 RLS/Auth가 담당한다.

## 마이그레이션 순서

1. Supabase SQL Editor에서 `supabase/migrations/20260619_auth_row_storage.sql` 실행
2. Auth URL 설정에 `https://jjuhee0722-cpu.github.io/workbook/` 등록
3. `npm run build`, `npm run validate`, `npm run test:sync`
4. GitHub Pages 배포
5. 첫 계정으로 로그인하여 기존 `workbook_sync/main` 데이터가 새 테이블/Storage로 이관되는지 확인
6. 확인 후 `supabase/migrations/20260619_lock_legacy.sql` 실행
7. Dashboard에 남은 `workbook_sync` anon/public SELECT policy가 있으면 제거

## 동기화 흐름

- Pull: 앱 시작, 탭 활성화, realtime 이벤트 발생 시 `sbPullRows(user.id)` 호출
- Push: 사용자가 데이터 변경 → `localDirtyRef.current = true` → 1.5초 디바운스 후 `sbPushRows()`
- 저장은 전체 JSON 덮어쓰기가 아니라 변경된 항목 row만 upsert
- 삭제는 항목/담당자에 tombstone(`deletedAt`)을 남겨 다른 기기에서 되살아나는 현상을 방지
- 분류 삭제는 실제 row delete
- 사진/첨부는 private Storage path만 DB에 저장하고 표시 시 signed URL을 생성

## 주요 구현 사항

### 로그인/보안

- 앱 진입 전에 Supabase Auth 로그인 필요
- RLS 정책은 `auth.uid() = user_id` 기준
- IndexedDB 캐시는 `user_id`가 바뀌면 초기화해 다른 계정 데이터가 섞이지 않도록 함
- 기존 화면 비밀번호 잠금은 로컬 편의 기능으로 유지

### 기존 데이터 이관

- 신규 계정의 row 데이터가 비어 있고 `workbook_profiles.legacy_migrated = false`이면 `workbook_sync/main`을 읽어 신규 row 테이블에 복사
- 기존 base64 사진/첨부는 가능한 경우 Storage에 업로드하고 path로 변환
- 이관 성공 후 profile에 `legacy_migrated = true` 기록

### 담당자(contacts) 동기화 핵심

- `prepareContactSnapshot()`에서 순서와 tombstone을 함께 보존
- `saveContacts()` / `forceSaveContacts()`에서 `dataRef.current`를 즉시 갱신해 stale closure 방지
- `forceSaveContacts()`는 디바운스 없이 즉시 push

## 파일 구조

- `src/index.html`: 편집 가능한 React JSX 원본
- `index.html`: GitHub Pages 배포 산출물, 직접 편집 금지
- `scripts/build.mjs`: JSX 사전 컴파일
- `scripts/validate_index.py`: 배포 구조 검증
- `scripts/test_sync_model.mjs`: 병합 모델 검증
- `supabase/migrations/*.sql`: Supabase 적용 SQL
- `SECURITY.md`: 보안/운영 메모
