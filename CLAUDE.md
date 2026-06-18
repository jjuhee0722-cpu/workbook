# 업무수첩 프로젝트

React + Supabase 기반 업무 관리 앱. JSX 원본을 빌드해 단일 `index.html`로 GitHub Pages에 배포함.

## 배포 정보
- **GitHub 저장소**: jjuhee0722-cpu/workbook
- **Pages URL**: https://jjuhee0722-cpu.github.io/workbook/
- **작업 파일**: src/index.html
- **배포 파일**: index.html (`npm run build`로 생성)

## 기술 스택
- React 18 UMD + Babel 사전 컴파일
- IndexedDB — 오프라인 로컬 저장
- Supabase JS v2 — 클라우드 동기화 (workbook_sync 테이블, 단일 row id=main)
- SheetJS — 엑셀 내보내기

## Supabase
- URL: https://qroxbykatxpqvvgaftom.supabase.co
- 테이블: workbook_sync / row: id=main / 컬럼: entries, cats, contacts (JSONB), synced_at
- anon key: index.html 상단 SB_KEY 변수에 있음

## GitHub 배포 방법 (Python)
`src/index.html` 수정 후 `npm run build`와 `python3 scripts/validate_index.py`를 실행하고 GitHub에 push:

1. GET https://api.github.com/repos/jjuhee0722-cpu/workbook/contents/index.html 로 현재 SHA 조회
2. 파일 base64 인코딩 후 PUT 요청으로 업로드
   - Authorization: token <GITHUB_TOKEN>  (별도 보관)
   - body: { message, content(b64), sha }

## 주요 구현 사항

### 비밀번호 잠금
- localStorage(wb_lock_pw) — SHA-256 해시 저장 (기존 평문은 로그인 시 자동 마이그레이션)
- sessionStorage(wb_session_ok) — 탭/창 세션 유지
- 최초 실행 시 setup 모드, 이후 lock 모드

### 동기화 흐름
- Push: 사용자가 데이터 변경 → localDirtyRef.current = true → 1.5초 디바운스 후 sbPush()
- Pull: 앱 시작, 탭 활성화, Supabase 실시간 이벤트 발생 시 pullAndMerge() 호출
- Push 전 최신 원격 데이터를 다시 읽고 항목별 `updatedAt`/`deletedAt` 기준으로 병합
- 삭제는 tombstone(`deletedAt`)으로 동기화하여 다른 기기에서 되살아나는 현상 방지
- 저장 버튼: forceSaveContacts() — 3초 대기 없이 즉시 push

### 담당자(contacts) 동기화 핵심
pullAndMerge() 내 contacts 처리:
- localDirtyRef.current === true → 로컬 순서 보호 (미push 변경 있음)
- localDirtyRef.current === false → 원격 순서 적용 (다른 기기 드래그 반영)
- saveContacts() / forceSaveContacts() 에서 dataRef.current 동기 업데이트 필수 (stale closure 방지)

### 모바일 드래그
- 핸들 onTouchStart → beginDrag(i)
- document.addEventListener(touchmove, handler, { passive: false }) 로 등록
  (React 합성 이벤트로는 e.preventDefault() 불가)
- drag 중일 때만 이벤트 등록/해제 (useEffect([dragIdx]))

### PGRST116 오류 처리
sbPull()에서 error.code === PGRST116 이면 null 반환 (첫 사용 시 행 없음, 정상)

## 파일 구조
- src/index.html: 편집 가능한 React JSX 원본
- index.html: GitHub Pages 배포 산출물, 직접 편집 금지
- scripts/build.mjs: JSX 사전 컴파일
- scripts/validate_index.py: 배포 구조 검증
- .github/workflows/validate-pages.yml: 자동 빌드·검증
- CLAUDE.md: 이 파일

## 주의사항
- 사진/파일 첨부는 base64로 Supabase 저장 → 대용량 시 동기화 느릴 수 있음
- GitHub Pages 공개 저장소 → Supabase anon key 소스 노출 (개인 용도로만 사용)
- 현재 workbook_sync/main은 anon 읽기가 가능함. SECURITY.md의 Supabase Auth + RLS 마이그레이션이 필수 후속 작업임
