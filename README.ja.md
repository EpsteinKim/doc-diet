[English](README.md) · [한국어](README.ko.md) · **日本語**

# doc-diet

AI エージェントが読むドキュメント（`CLAUDE.md`、領域ごとの知識ファイル）を**ロスレスに短くし**、短い版だけを読んだ新しいエージェントが**まだ正しく答えられるかを測る**。

## なぜ

長く続くプロジェクトでは、エージェント向けドキュメントが数千行に膨らむ。経緯、計測値、すでに直したバグの話。セッションやサブエージェントはそのたびに全部を読むので、起動が遅く、コンテキストが早く埋まり、今有効なルールが経緯に埋もれる。要約すればサイズは減るが、二つの問いに答えられない。*何を失ったか？* *要約は正しいか？* doc-diet はこの二つを機械的に答える。

## インストール

```
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

インストールせずに試す: `claude --plugin-dir /path/to/doc-diet`。

## 機能

**1. ドキュメントを分ける（スキル `split-doc`）。** Claude に長いドキュメントを分けるよう頼む。原本を `<name>.record.md` にバイト単位でそのままコピーし、`<name>.md` を 150〜300 行のヘッド（今有効なルール、落とし穴、決定、未解決事項。各行末に `(record §N)`）として書き直し、`scripts/verify-split.sh` を実行する。`cmp` でレコードが原本と同一であることを証明し、ヘッド内のバッククォート名がレコードとコードに実在するかを grep で確認する。

**2. 理解度の計測（`/doc-diet:check <head-file> [questions...]`）。** 読み取り専用の `doc-tester` エージェントがヘッドだけを読み（時間とバイト数を記録）、質問に答えてそれぞれ *in-head / not / ambiguous* を付け、その後コードとレコードを grep して *right / partial / wrong* で採点する。

```
/doc-diet:check docs/agents/billing.md "返金はどの日数基準を使う？" "請求書を削除できるのは誰？"

# | question            | in-head | grade | correct answer
1 | refund day basis    | in-head | right |
2 | who may delete      | not     | wrong | finance role only (record §14)
What the head should have had: the delete-permission rule.
```

ほかに、維持ルールをまとめた `keep-heads-fresh` スキル（決定は同じターンでヘッドに入れる、誤った判定はレコードで取り消し線を引く、300 行の上限）と、頼まなくても知らせるフック（下記）が入っている。

## 自動の知らせ

フックは Claude にコンテキストを一行足すだけで、ドキュメントを分けたり編集したりはしない。PATH に `node` が必要（なければ黙って何もしない）。知らせはセッションごと、ファイルごとに一度だけ（状態は `${CLAUDE_PLUGIN_DATA}`、なければ `$TMPDIR` に、セッション id か日付をキーに保存）。

| タイミング | 条件 | 内容 |
|---|---|---|
| SessionStart | プロジェクトにレコードがある | ヘッドは全部読み、レコードは必要なときだけ grep（毎回） |
| SessionStart | `CLAUDE.md`、`AGENTS.md`、`.claude/**/*.md` または `docGlobs` のファイルが `bigDocLines` か `bigDocBytes` を超え、レコードがない | `split-doc` を提案 |
| SessionStart | 最後の `/doc-diet:check` 以降、ヘッドが `measureAfterCommits` 回以上のコミットで変わった | `/doc-diet:check <head>` を提案 |
| Edit/Write/MultiEdit の後 | 編集したヘッド（レコードがあるもの）が `maxHeadLines` を超えた | 詳細をレコードへ移すよう知らせる |
| Edit/Write/MultiEdit の後 | ファイルが `decisionGlobs` に一致（既定はオフ） | このターンでルールをヘッドに入れるよう知らせる |

`/doc-diet:check` は `scripts/mark-checked.mjs` で `.doc-diet/last-check.json`（ヘッドのパス → git コミット）を書く。コミットしても gitignore しても構わない。セッション開始時のスキャンは深さ 6 までで、`node_modules`、`.git`、`dist`、`build`、`.next`、`.venv`、`vendor`、`target` を飛ばす。5,000 ファイルのツリーで約 50 ms。

### 設定: `.doc-diet.json`（任意、プロジェクトルート、すべてのキーは任意）

```json
{ "recordSuffix": ".record.md", "maxHeadLines": 300, "bigDocLines": 300, "bigDocBytes": 30000,
  "docGlobs": [], "decisionGlobs": ["docs/decisions/*.md"], "measureAfterCommits": 5 }
```

グロブはプロジェクトルート基準（`*` はフォルダ内、`**` はフォルダをまたぐ）。レコードの命名が違うプロジェクトでは `recordSuffix` を使う。例: `.history.md`、`.記録.md`。

## 実際の結果（手作業で適用、匿名化）

業務用 Web アプリ一つ、領域ドキュメント 11 本と共通ドキュメント（最大 4,400 行）に適用した。担当が開始時に読む量が約 440 KB から約 70 KB（約 1/6）に減り、三つのドキュメントを 2〜5 秒で読む。三回目の計測でヘッドから抜けていた重要なルールを二つ見つけた。要約で落ちた例外が一つと、前日に決まったがまだヘッドに入っていなかった決定が一つ。

## 似たツールとの比較

- `agent-md-refactor`（softaworks/agent-toolkit）: 大きなドキュメントをリンクされたファイルに分ける。整理しながら削り、検証はない。
- `claude-token-diet`（MUKE-coder）: トークン節約設定の詰め合わせ（拒否ルール、薄い CLAUDE.md、LSP）。名前が似ているだけで別物。
- claude-mem / Mem0 / Hindsight: 会話と作業履歴のメモリ。対象が違う。
- **doc-diet だけのもの:** `cmp` で証明するロスレスの保管、新しいエージェントの理解度計測と採点、ドキュメントがコードと食い違う箇所の一覧。

## 制限

- コンテキスト比率と時間はエージェントの自己申告。
- 計測は質問の質まで。答えが決まっている質問、できれば実際の過去の失敗から取った質問を使う。
- 質問の自動生成はまだない（0.2.0 予定）。
- ヘッドは Claude が書く。レビューすること。`cmp` が守るのはレコードだけ。

## ライセンス

MIT
