# 기여 가이드

## 브랜치 전략

```
main        ← 배포용, PR로만 병합 (직접 push 금지)
develop     ← 통합 브랜치
feat/xxx    ← 기능 개발
fix/xxx     ← 버그 수정
```

작업 흐름: `feat/xxx` → PR → `develop` → PR → `main`

---

## 커밋 컨벤션

```
<type>: <제목>
```

| type | 용도 |
|------|------|
| `feat` | 새 기능 |
| `fix` | 버그 수정 |
| `refactor` | 리팩토링 (동작 변경 없음) |
| `docs` | 문서, 주석 |
| `chore` | 설정, 패키지, 빌드 |
| `style` | 코드 포맷 (ESLint/Prettier) |

**예시**
```
feat: 도넛 UI 섹터 호버 하이라이트 추가
fix: 로그인 세션 만료 시 재로그인 안 되는 문제 수정
chore: ESLint 설정 추가
```

규칙
- 제목은 한국어 또는 영어 통일
- 제목 끝에 마침표 없음
- 본문이 필요하면 빈 줄 한 줄 띄우고 작성

---

## PR 규칙

- 이슈 없이 PR 금지 (먼저 Issue 생성)
- PR은 `develop` 브랜치로만 올림
- 셀프 리뷰 후 팀원 1명 이상 Approve 받고 머지

---

## 로컬 개발 환경

```bash
# 설치
npm install

# 개발 서버 실행
npm run dev

# 린트 검사
npm run lint

# 린트 자동 수정
npm run lint:fix
```
