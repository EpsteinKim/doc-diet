[English](README.md) · **한국어** · [日本語](README.ja.md)

# doc-diet

AI 에이전트가 읽는 문서(`CLAUDE.md`, 영역별 지식 문서)를 **무손실로 줄이고**, 줄인 문서만 읽은 새 에이전트가 **여전히 맞게 답하는지 잰다**.

## 왜

오래 쓴 프로젝트는 에이전트 문서가 수천 줄로 불어난다. 경위, 실측값, 이미 고친 버그 이야기가 쌓인다. 매 세션과 서브에이전트가 그걸 통째로 읽으니 시작이 느리고, 컨텍스트가 일찍 차고, 지금 유효한 규칙이 경위에 묻힌다. 요약하면 크기는 줄지만 두 질문에 답할 수 없다. *무엇을 잃었나?* *요약이 맞나?* doc-diet는 이 둘을 기계적으로 답한다.

## 설치

```
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

설치 없이 써 보기: `claude --plugin-dir /path/to/doc-diet`.

## 기능

**1. 문서 나누기 (스킬 `split-doc`).** Claude에게 긴 문서를 나누라고 한다. 원본을 `<name>.record.md`로 바이트 그대로 복사하고, `<name>.md`를 150~300줄의 앞머리(지금 참인 규칙, 함정, 결정, 열린 일. 각 줄 끝에 `(record §N)`)로 새로 쓴 뒤 `scripts/verify-split.sh`를 돌린다. `cmp`로 기록이 원본과 동일함을 증명하고, 앞머리의 백틱 이름이 기록과 코드에 실제로 있는지 grep으로 확인한다.

**2. 이해도 측정 (`/doc-diet:check <head-file> [questions...]`).** 읽기 전용 `doc-tester` 에이전트가 앞머리만 읽고(시간과 바이트를 잰다), 질문에 답하며 각각 *in-head / not / ambiguous*로 표시한 다음, 코드와 기록을 grep해서 *right / partial / wrong*으로 채점한다.

```
/doc-diet:check docs/agents/billing.md "환불은 어느 일수 기준을 쓰나?" "송장은 누가 지울 수 있나?"

# | question            | in-head | grade | correct answer
1 | refund day basis    | in-head | right |
2 | who may delete      | not     | wrong | finance role only (record §14)
What the head should have had: the delete-permission rule.
```

그 밖에 유지 규칙을 담은 `keep-heads-fresh` 스킬(결정은 같은 턴에 앞머리에 넣기, 틀린 판정은 기록에서 줄 긋기, 300줄 상한)과, 말하지 않아도 알려주는 훅(아래)이 들어 있다.

## 자동 알림

훅은 Claude에게 문맥 한 줄을 더할 뿐, 문서를 나누거나 고치지 않는다. PATH에 `node`가 필요하다(없으면 조용히 아무것도 안 한다). 알림은 세션마다, 파일마다 한 번만 뜬다(상태는 `${CLAUDE_PLUGIN_DATA}`, 없으면 `$TMPDIR`에 세션 id 또는 날짜로 저장).

| 시점 | 조건 | 내용 |
|---|---|---|
| SessionStart | 프로젝트에 기록 파일이 있다 | 앞머리는 끝까지 읽고, 기록은 필요할 때만 grep (매 시작) |
| SessionStart | `CLAUDE.md`, `AGENTS.md`, `.claude/**/*.md` 또는 `docGlobs` 파일이 `bigDocLines`나 `bigDocBytes`를 넘고 기록이 없다 | `split-doc` 제안 |
| SessionStart | 마지막 `/doc-diet:check` 이후 앞머리가 `measureAfterCommits`개 이상의 커밋에서 바뀌었다 | `/doc-diet:check <head>` 제안 |
| Edit/Write/MultiEdit 뒤 | 고친 앞머리(기록이 있는 것)가 `maxHeadLines`를 넘는다 | 상세를 기록으로 옮기라고 알림 |
| Edit/Write/MultiEdit 뒤 | 파일이 `decisionGlobs`에 맞는다 (기본은 꺼짐) | 이번 턴에 규칙을 앞머리에 넣으라고 알림 |

`/doc-diet:check`는 `scripts/mark-checked.mjs`로 `.doc-diet/last-check.json`(앞머리 경로 → git 커밋)을 쓴다. 커밋하든 gitignore하든 자유다. 세션 시작 스캔은 깊이 6까지이고 `node_modules`, `.git`, `dist`, `build`, `.next`, `.venv`, `vendor`, `target`은 건너뛴다. 파일 5,000개 트리에서 약 50ms.

### 설정: `.doc-diet.json` (선택, 프로젝트 루트, 모든 키 선택)

```json
{ "recordSuffix": ".record.md", "maxHeadLines": 300, "bigDocLines": 300, "bigDocBytes": 30000,
  "docGlobs": [], "decisionGlobs": ["docs/decisions/*.md"], "measureAfterCommits": 5 }
```

글롭은 프로젝트 루트 기준이다(`*`는 폴더 안, `**`는 폴더를 가로질러). 기록 파일 이름이 다른 프로젝트는 `recordSuffix`를 쓴다. 예: `.history.md`, `.기록.md`.

## 실제 결과 (손으로 적용, 익명)

업무용 웹 앱 하나, 영역 문서 11개와 공통 문서(가장 큰 것 4,400줄)에 적용했다. 담당이 시작할 때 읽는 양이 약 440KB에서 약 70KB(약 1/6)로 줄었고, 문서 세 개를 2~5초에 읽는다. 세 번째 측정에서 앞머리에 빠진 중요한 규칙 둘을 찾았다. 요약하다 빠진 예외 하나와, 전날 정해졌지만 아직 앞머리에 들어가지 않은 결정 하나.

## 비슷한 도구와 비교

- `agent-md-refactor` (softaworks/agent-toolkit): 큰 문서를 링크된 파일들로 나눈다. 정리하면서 지우고, 검증이 없다.
- `claude-token-diet` (MUKE-coder): 토큰 절감 설정 묶음(거부 규칙, 얇은 CLAUDE.md, LSP). 이름이 비슷할 뿐 다른 것이다.
- claude-mem / Mem0 / Hindsight: 대화와 작업 이력의 메모리. 대상이 다르다.
- **doc-diet만의 것:** `cmp`로 증명하는 무손실 보관, 새 에이전트 이해도 측정과 채점, 문서가 코드와 어긋나는 곳의 목록.

## 한계

- 컨텍스트 비율과 시간은 에이전트가 스스로 보고하는 값이다.
- 측정은 질문만큼만 좋다. 답이 정해진 질문, 되도록 실제 과거 실수에서 나온 질문을 쓴다.
- 질문 자동 생성은 아직 없다 (0.2.0 예정).
- 앞머리는 Claude가 쓴다. 검토하라. `cmp` 검사가 지키는 것은 기록뿐이다.

## 라이선스

MIT
