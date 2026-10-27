# Workbook 작업 지침

- 운영 주소: https://jjuhee0722-cpu.github.io/workbook/
- `CLAUDE.md`에서 파일 구조를, `OPERATIONS.md`에서 배포/장애 대응을 확인한다.
- `src/index.html`은 템플릿이고 실제 기능은 `src/ui`, `src/data`, `src/app.jsx`에 있다.
- `index.html`은 생성물이다. 원본 변경 후 `npm run build`로 만들고 함께 커밋한다.
- `python3 scripts/validate_index.py`와 `npm run test:sync`, `test:ui`, `test:auth`, `test:cloud`를 실행한다.
- 기존 계정, 업무, 완료 상태, 서식, 사진, tombstone을 보존한다. 별도 요청 없이 DB 초기화나 스키마 변경을 하지 않는다.
- 체크박스는 선택, 완료 버튼은 상태 변경이다. 목록·달력·태그 화면에서 상태 필터를 일관되게 유지한다.
- 임시 체크아웃의 로컬 파일 경로를 홈페이지 링크로 전달하지 않는다.
