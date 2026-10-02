[English](README.md) · **한국어** · [日本語](README.ja.md) · [简体中文](README.zh.md)

# doc-diet

`CLAUDE.md`와 에이전트가 읽는 지식 문서는 계속 불어난다. 내 경우 영역 문서 11개에 공통 문서 하나, 제일 큰 게 4,400줄까지 갔고, 서브에이전트는 뭘 시작하든 그걸 다 읽고 나서야 움직였다. 줄여 쓰면 될 것 같지만, 그러면 뭘 버렸는지, 줄인 게 맞기는 한지 알 수가 없다.

doc-diet는 줄이되, 나중에 확인할 수 있게 줄인다. 원본은 `<name>.record.md`로 바이트 하나 안 바뀌고 남는다. 아래에서는 이 파일을 기록이라고 부른다. `<name>.md` 자리에는 지금도 유효한 내용만 담은 요약본(150-300줄)이 들어가고, 줄마다 기록의 어디서 왔는지 적는다. 플러그인은 이 요약본을 head라고 부른다. 그런 다음 새 에이전트가 요약본만 읽고 질문을 받는다. 줄이다 뭘 잃었는지, 그게 아쉬워지기 전에 알 수 있다.

## 설치

```
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

설치 없이 쓰려면 `claude --plugin-dir /path/to/doc-diet`.

## 들어 있는 것

### split-doc

Claude에게 파일을 나누라고 하면 이 스킬이 맡는다. 원본을 `<name>.record.md`로 복사하고, `<name>.md`를 요약본으로 다시 쓰고, `scripts/verify-split.sh`를 돌린다. 이 스크립트는 기록을 원본과 `cmp`로 대조한 뒤, 요약본에서 백틱으로 감싼 이름을 전부 기록과 코드에서 grep한다.

### /doc-diet:check

`/doc-diet:check <head-file> [questions...]`는 읽기 전용 에이전트 `doc-tester`에게 요약본만 읽게 한다. 그것만 보고 질문에 답하면서 답마다 in-head / not / ambiguous를 붙이고, 그러고 나서야 코드와 기록을 보고 스스로 right / partial / wrong으로 채점한다.

```
/doc-diet:check docs/agents/billing.md "Which day basis do refunds use?" "Who may delete an invoice?"

# | question            | in-head | grade | correct answer
1 | refund day basis    | in-head | right |
2 | who may delete      | not     | wrong | finance role only (record §14)
What the head should have had: the delete-permission rule.
```

질문은 직접 주거나, 결정 문서를 가리켜서 거기서 고르게 한다. 전에 한 번 틀렸던 일에 대한 질문이 제일 잘 먹힌다. 결정 문서 없이 질문을 만들어 내는 건 0.2.0에 넣을 예정이다.

### keep-heads-fresh

규칙 세 개. 결정을 결정 문서에 적으면 그 턴에 요약본에도 넣는다. 판정이 틀린 걸로 드러나면 기록에서 지우지 말고 줄을 긋는다. 요약본은 300줄 아래로 유지한다.

## 훅

훅 두 개. 컨텍스트에 몇 줄 덧붙일 뿐 파일은 건드리지 않는다. PATH에 `node`가 있어야 하고 없으면 아무것도 안 한다. 기록 파일을 알리는 줄은 세션을 열 때마다 뜨고, 나머지는 세션마다 파일마다 한 번만 뜬다. 상태는 `${CLAUDE_PLUGIN_DATA}`(없으면 `$TMPDIR`)에 세션 id나 날짜별로 저장한다.

세션이 시작할 때:

- 프로젝트에 기록 파일이 있으면, 요약본은 끝까지 읽고 기록은 `(record §N)`을 따라갈 때만 grep하라고 Claude에게 알린다
- `CLAUDE.md`, `AGENTS.md`, `.claude/` 아래 파일, 또는 `docGlobs`에 맞는 파일이 `bigDocLines`보다 길거나 `bigDocBytes`보다 큰데 기록이 없으면, 나누자고 제안한다
- 어떤 요약본을 마지막으로 `/doc-diet:check`한 뒤로 그 파일을 건드린 커밋이 `measureAfterCommits`개 이상이면, 다시 확인하자고 제안한다(요약본 20개까지만 본다)

Edit, Write, MultiEdit 뒤에:

- 그 파일이 요약본인데 `maxHeadLines`를 넘었으면 그렇다고 알린다
- 그 파일이 `decisionGlobs`에 맞으면(기본값은 없음, 아래 예시는 `docs/decisions/`에 켜 둔 것) 이번 턴에 규칙을 요약본에 넣으라고 Claude에게 알린다

`/doc-diet:check`는 실행한 시점의 커밋을 `scripts/mark-checked.mjs`로 `.doc-diet/last-check.json`에 적는다. 그 파일은 커밋하든 무시하든 상관없다. 시작할 때의 스캔은 디렉터리 6단계까지만 내려가고, `node_modules`, `.git`, `dist`, `build`, `.next`, `.venv`, `vendor`, `target`은 건너뛰며, 파일 5,000개짜리 트리에서 50 ms 정도 걸린다.

설정은 프로젝트 루트의 `.doc-diet.json`에 둔다. 키는 전부 선택 사항이다. 아래는 기본값이 아니라 예시이고, `decisionGlobs`는 따로 넣지 않으면 비어 있다.

```json
{ "recordSuffix": ".record.md", "maxHeadLines": 300, "bigDocLines": 300, "bigDocBytes": 30000,
  "docGlobs": [], "decisionGlobs": ["docs/decisions/*.md"], "measureAfterCommits": 5 }
```

glob은 프로젝트 루트 기준이다. 기록 파일 이름이 다르면 `recordSuffix`를 바꾸면 된다(`.history.md`나 `.기록.md` 같은 것).

## 써 보니

위 프로젝트에서 영역 담당 에이전트가 시작할 때 읽는 양이 440 KB쯤에서 70 KB쯤으로 줄었고, 시간을 재 본 영역 문서 세 개는 읽는 데 각각 2-5초 걸렸다. 더 쓸모 있었던 건 세 번째 확인이었다. 요약본에 없던 규칙 둘이 나왔다. 하나는 요약하다 빠진 예외였다. 다른 하나는 전날 정해졌는데 아무도 반영하지 않은 결정이었다. `keep-heads-fresh`가 생긴 이유다.

## 알아둘 것

위의 시간은 에이전트가 스스로 보고한 값이다. `/doc-diet:check`는 물어본 것만 확인한다. 요약본 자체가 맞는지는 아무도 검사하지 않으니 직접 읽어 봐야 한다.

이름이 비슷한 것들: `agent-md-refactor`(softaworks/agent-toolkit)는 문서를 나누긴 하는데 내용을 쳐내고 검증은 안 한다. `claude-token-diet`(MUKE-coder)는 토큰 절감 설정 모음이다. claude-mem, Mem0, Hindsight는 문서가 아니라 대화를 저장한다.

MIT.
