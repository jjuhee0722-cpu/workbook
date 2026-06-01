# 업무수첩 프로젝트

React + Supabase 기반 업무 관리 앱. 단일 HTML 파일(index.html)로 구성되어 GitHub Pages에 배포됨.

## 배포 정보
- **GitHub 저장소**: jjuhee0722-cpu/workbook
- **Pages URL**: https://jjuhee0722-cpu.github.io/workbook/
- **작업 파일**: index.html (로컬 편집 후 GitHub API로 push → Pages 자동 배포)

## 기술 스택
- React 18 UMD + Babel Standalone (CDN, 빌드 도구 없음)
- IndexedDB — 오프라인 로컬 저장
- Supabase JS v2 — 클라우드 동기화 (workbook_sync 테이블, 단일 row id=main)
- SheetJS — 엑셀 내보내기

## Supabase
- URL: https://qroxbykatxpqvvgaftom.supabase.co
- 테이블: workbook_sync / row: id=main / 컬럼: entries, cats, contacts (JSONB), synced_at
- anon key: index.html 상단 SB_KEY 변수에 있음

## GitHub 배포 방법 (Python)
로컬 index.html 수정 후 GitHub Contents API로 push:

1. GET https://api.github.com/repos/jjuhee0722-cpu/workbook/contents/index.html 로 현재 SHA 조회
2. 파일 base64 인코딩 후 PUT 요청으로 업로드
   - Authorization: token <GITHUB_TOKEN>  (별도 보관)
   - body: { message, content(b64), sha }

## 주요 구현 사항

### 비밀번호 잠금
- localStorage(wb_lock_pw) — 비밀번호 저장
- sessionStorage(wb_session_ok) — 탭/창 세션 유지
- 최초 실행 시 setup 모드, 이후 lock 모드

### 동기화 흐름
- Push: 사용자가 데이터 변경 → localDirtyRef.current = true → 3초 디바운스 후 sbPush()
- Pull: 앱 시작, 탭 활성화, Supabase 실시간 이벤트 발생 시 pullAndMerge() 호출
- Cascade 방지: pull 후 로컬 우세 항목 없으면 localDirtyRef.current = false → 재push 안 함
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
- index.html  : 전체 앱 (React 컴포넌트 + 로직 통합, ~1500줄)
- CLAUDE.md   : 이 파일 (프로젝트 컨텍스트)

## 주의사항
- 사진/파일 첨부는 base64로 Supabase 저장 → 대용량 시 동기화 느릴 수 있음
- GitHub Pages 공개 저장소 → Supabase anon key 소스 노출 (개인 용도로만 사용)
