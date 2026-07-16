# 보안 검토

## 개편 후 상태

- Supabase anon key는 브라우저 앱에 포함되는 공개 키입니다. 노출 자체는 문제가 아니며, 접근 제어는 Supabase Auth와 RLS가 담당합니다.
- 앱은 Supabase Auth 로그인 후에만 열립니다.
- 업무 항목, 분류, 담당자는 `user_id = auth.uid()` 조건의 RLS 정책으로 보호됩니다.
- 사진/첨부는 private Storage bucket `workbook`에 `사용자 UUID/파일명` 경로로 저장됩니다.
- 앱은 DB에 Storage path를 저장하고, 화면 표시 시 24시간 signed URL을 발급합니다.
- IndexedDB 캐시는 로그인 사용자 ID가 바뀌면 초기화됩니다.

## 기존 데이터 이관

- `workbook_sync/main`은 신규 계정의 첫 로그인 때 한 번만 읽어 신규 row 테이블로 이관합니다.
- 이관 확인 전까지는 `workbook_sync_legacy_migration_read` 정책을 임시로 유지합니다.
- 이관 확인 후 `supabase/migrations/20260619_lock_legacy.sql`을 실행해 legacy read 정책을 제거합니다.
- Supabase Dashboard에 과거 anon/public SELECT policy가 남아 있으면 수동 제거해야 합니다.

## 운영 주의

- GitHub Pages는 정적 호스팅이므로 비밀키(service role key)를 절대 넣지 않습니다.
- Storage signed URL은 공유되면 만료 전까지 열람 가능하므로 민감한 파일은 URL을 외부에 전달하지 않는 것이 좋습니다.
- 무료 플랜 용량을 넘기지 않도록 대용량 영상/압축파일 업로드는 피하는 편이 안전합니다.
