# Changelog

## 2026-08-30

### Added

- `날짜별` 탭을 아이폰 달력처럼 연도/월별 캘린더 화면으로 개편했습니다.
- 작성된 날짜 아래에 업무 분류 색상 점을 표시하도록 했습니다.
- 날짜를 누르면 해당 날짜에 작성된 미완료 항목 제목 목록을 보여주고, 제목을 누르면 수정 화면으로 들어가도록 했습니다.

## 2026-07-20

### Added

- 앱 사이드바에 `🩺 동기화 진단` 버튼을 추가했습니다.
- 진단 화면에서 로그인 계정, 온라인 상태, 동기화 상태, 마지막 pull/push/realtime 시간, 로컬 변경 대기 여부, 데이터 개수, 마지막 오류 메시지를 확인할 수 있게 했습니다.
- `OPERATIONS.md`에 동기화 먹통 대응 체크리스트, Supabase 구조, 배포 순서, 복구 기준을 추가했습니다.

### Changed

- realtime 이벤트가 몰릴 때 동기화 요청이 무한히 쌓이지 않도록 pull 중복 실행을 합치고 debounce 처리했습니다.

### Previous structural migration

- 업무수첩을 기존 `workbook_sync/main` 단일 JSON row 구조에서 Supabase Auth + 사용자별 row table + private Storage 구조로 전환했습니다.
- 기존 데이터는 첫 로그인 시 신규 테이블로 1회 이관되도록 구성했습니다.
- 사진/첨부는 DB base64 대신 private Storage path와 signed URL을 사용합니다.
