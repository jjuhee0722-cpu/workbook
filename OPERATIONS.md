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

## 보안

화면 잠금은 로컬 편의 기능이며 Supabase 접근 제어가 아닙니다. 클라우드 데이터 보호 상태와 Auth/RLS 전환 계획은 `SECURITY.md`를 확인합니다.
