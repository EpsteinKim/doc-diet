[English](README.md) · [한국어](README.ko.md) · **日本語** · [简体中文](README.zh.md)

# doc-diet

`CLAUDE.md` とエージェントが読む知識ファイルは増え続ける。自分の場合、領域ドキュメント 11 本と共通ドキュメント 1 本、いちばん大きいもので 4,400 行になり、サブエージェントは何を始めるにもまずその山を全部読んでいた。短くまとめればいいようでいて、それだと何を捨てたのか、まとめが合っているのかが分からない。

doc-diet は削るが、あとから確かめられるように削る。原本は `<name>.record.md` として 1 バイトも変えずに残す。以下ではこれを記録と呼ぶ。`<name>.md` の場所には、今も有効な内容だけを入れた短縮版（150〜300 行）が入り、各行に記録のどこから来たかを書く。プラグインはこの短縮版を head と呼ぶ。そのうえで新しいエージェントが短縮版だけを読んで質問に答える。なので、削って何が抜けたかは困る前に分かる。

## インストール

```
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

インストールせずに使うなら `claude --plugin-dir /path/to/doc-diet`。

## 入っているもの

### split-doc

Claude にファイルを分けるよう頼むと、このスキルが引き受ける。原本を `<name>.record.md` にコピーし、`<name>.md` を短縮版として書き直し、`scripts/verify-split.sh` を実行する。スクリプトは記録を原本と `cmp` で突き合わせ、そのあと短縮版にあるバッククォートで囲んだ名前をすべて記録とコードから grep する。

### /doc-diet:check

`/doc-diet:check <head-file> [questions...]` は読み取り専用のエージェント `doc-tester` に短縮版だけを読ませる。それだけを見て質問に答え、答えごとに in-head / not / ambiguous を付け、そのあとでようやくコードと記録を見て right / partial / wrong で自己採点する。

```
/doc-diet:check docs/agents/billing.md "Which day basis do refunds use?" "Who may delete an invoice?"

# | question            | in-head | grade | correct answer
1 | refund day basis    | in-head | right |
2 | who may delete      | not     | wrong | finance role only (record §14)
What the head should have had: the delete-permission rule.
```

質問は自分で渡すか、決定をまとめたファイルを指してそこから選ばせる。前に一度間違えたことについての質問がいちばん効く。自動生成は 0.2.0 で入れる予定。

### keep-heads-fresh

ルールは三つある。決定をファイルに書いたら、同じターンで短縮版にも入れる。判定が間違っていたと分かったら、記録から消さずに取り消し線を引く。短縮版は 300 行未満に保つ。

## フック

フックは二つある。それぞれコンテキストを 1 行足すだけで、ファイルには触らない。PATH に `node` が必要で、なければ何もしない。通知はセッションごと、ファイルごとに 1 回だけ。状態は `${CLAUDE_PLUGIN_DATA}`（未設定なら `$TMPDIR`）に、セッション ID か日付をキーにして保存する。

セッション開始時:

- プロジェクトに記録ファイルがあれば、短縮版は全部読み、記録は `(record §N)` をたどるときだけ grep するよう Claude に伝える
- `CLAUDE.md`、`AGENTS.md`、`.claude/` 以下のファイル、または `docGlobs` に合うファイルが `bigDocLines` より長いか `bigDocBytes` より大きく、記録がなければ、分割を提案する
- ある短縮版を前回 `/doc-diet:check` してから、そのファイルに触れたコミットが `measureAfterCommits` 回以上あれば、もう一度確認するよう提案する

Edit、Write、MultiEdit のあと:

- そのファイルが短縮版で `maxHeadLines` を超えたなら、そう警告する
- そのファイルが `decisionGlobs` に合うなら（既定は空、下の例では `docs/decisions/` に対して有効にしている）、このターンでルールを短縮版に入れるよう Claude に伝える

`/doc-diet:check` は実行時点のコミットを `scripts/mark-checked.mjs` 経由で `.doc-diet/last-check.json` に保存する。このファイルはコミットしても無視してもいい。開始時のスキャンはディレクトリ 6 階層まで、`node_modules`、`.git`、`dist`、`build`、`.next`、`.venv`、`vendor`、`target` は飛ばし、5,000 ファイルのツリーで 50 ms ほどかかる。

設定はプロジェクトルートの `.doc-diet.json` に置く。キーはすべて任意。

```json
{ "recordSuffix": ".record.md", "maxHeadLines": 300, "bigDocLines": 300, "bigDocBytes": 30000,
  "docGlobs": [], "decisionGlobs": ["docs/decisions/*.md"], "measureAfterCommits": 5 }
```

glob はプロジェクトルート基準。記録ファイルの名前が違うなら `recordSuffix` を変える（`.history.md` や `.記録.md` など）。

## 使ってみて

上のプロジェクトで、各領域の担当エージェントが開始時に読む量は 440 KB ほどから 70 KB ほどに減り、時間を測った領域ドキュメント 3 本はそれぞれ 2〜5 秒で読めた。それより役に立ったのは 3 回目の確認で、短縮版から抜けていたルールが 2 つ出てきたこと。1 つはまとめる途中で落ちた例外。もう 1 つは前日に決まったのに誰も反映していなかった決定。`keep-heads-fresh` があるのはそのため。

## 注意

上の時間はエージェントの自己申告。`/doc-diet:check` が確かめるのは質問した内容だけ。短縮版そのものが正しいかどうかはこのプラグインでは確かめないので、自分で読むこと。

名前が似ているもの: `agent-md-refactor`（softaworks/agent-toolkit）はドキュメントを分けるが、中身を削りながら分けて検証はしない。`claude-token-diet`（MUKE-coder）はトークン節約設定のセット。claude-mem、Mem0、Hindsight が保存するのは会話で、ドキュメントではない。

MIT.
