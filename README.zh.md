[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · **简体中文**

# doc-diet

`CLAUDE.md` 和代理要读的知识文件会一直长。我这边长到了 11 份领域文档加 1 份公共文档，最大的 4,400 行，每个子代理不管干什么都得先把这一摞读完。最直接的办法是做摘要，但那样你就说不清扔掉了什么，也说不清摘要对不对。

doc-diet 也是删，但删完能核对。原文一个字节不动，留作 `<name>.record.md`，下文叫它存档。`<name>.md` 改写成精简版（150-300 行），只留仍然成立的内容，每行注明出自存档的哪一节。插件把这个精简版叫 head。然后让一个新代理只看精简版，再回答问题，这样还没用上，就能先发现删丢了什么。

## 安装

```
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

不装也能用：`claude --plugin-dir /path/to/doc-diet`。

## 里面有什么

### split-doc

让 Claude 拆一个文件，这个技能就接手。它把原文复制为 `<name>.record.md`，把 `<name>.md` 重写成精简版，然后运行 `scripts/verify-split.sh`。脚本先用 `cmp` 把存档和原文比对，再把精简版里每个反引号括起来的名字，到存档和你的代码里各 grep 一遍。

### /doc-diet:check

`/doc-diet:check <head-file> [questions...]` 派一个只读的 `doc-tester` 代理去看精简版，别的都不让它看。它只凭这个回答你的问题，每个答案标上 in-head / not / ambiguous，之后才去看代码和存档，给自己评 right / partial / wrong。

```
/doc-diet:check docs/agents/billing.md "Which day basis do refunds use?" "Who may delete an invoice?"

# | question            | in-head | grade | correct answer
1 | refund day basis    | in-head | right |
2 | who may delete      | not     | wrong | finance role only (record §14)
What the head should have had: the delete-permission rule.
```

问题你来给，或者指一份决策文件让它自己挑。问以前出过错的事效果最好。不给决策文件也能自动出题，打算放在 0.2.0。

### keep-heads-fresh

三条规则：把决定写进决策文件时，同一轮也写进精简版；某个结论错了，在存档里划掉而不是删掉；精简版保持在 300 行以内。

## 钩子

两个钩子。加几行上下文，不碰文件。需要 PATH 里有 `node`，没有就不出声。提示有存档文件的那一行每次会话开始都出；其余提醒每个会话每个文件只触发一次，状态放在 `${CLAUDE_PLUGIN_DATA}`，没设就放 `$TMPDIR`，以会话 id 或日期为键。

会话开始时：

- 项目里有存档文件的话，告诉 Claude 精简版要通读，存档只在顺着 `(record §N)` 找的时候才 grep
- `CLAUDE.md`、`AGENTS.md`、`.claude/` 下的文件或匹配 `docGlobs` 的文件，行数超过 `bigDocLines` 或体积超过 `bigDocBytes`、又没有存档的话，建议拆
- 某个精简版自上次 `/doc-diet:check` 以来，改动过的提交数达到 `measureAfterCommits` 的话，建议再查一次（只看前 20 个精简版）

Edit、Write 或 MultiEdit 之后：

- 这个文件是精简版且超过了 `maxHeadLines`，就说一声
- 这个文件匹配 `decisionGlobs`（默认为空，下面的示例把它配成了 `docs/decisions/`），就提醒 Claude 这一轮把规则写进精简版

`/doc-diet:check` 通过 `scripts/mark-checked.mjs` 把运行当时的 commit 存进 `.doc-diet/last-check.json`。这个文件提交或忽略都行。启动时最多扫 6 层目录，跳过 `node_modules`、`.git`、`dist`、`build`、`.next`、`.venv`、`vendor` 和 `target`，5,000 个文件的目录树大约要 50 ms。

设置放在项目根目录的 `.doc-diet.json`。所有键都可选。下面是示例，不是默认值；`decisionGlobs` 不设就是空的：

```json
{ "recordSuffix": ".record.md", "maxHeadLines": 300, "bigDocLines": 300, "bigDocBytes": 30000,
  "docGlobs": [], "decisionGlobs": ["docs/decisions/*.md"], "measureAfterCommits": 5 }
```

通配符相对于项目根目录。存档文件叫别的名字，就改 `recordSuffix`（比如 `.history.md` 或 `.记录.md`）。

## 实际用下来

在上面那个项目里，每个领域代理启动时要读的量从 440 KB 左右降到 70 KB 左右；我计时的三份领域文档各用 2-5 秒读完。更有用的是，第三轮检查找出了精简版漏掉的两条规则。一条是摘要时丢的例外。另一条是前一天定的、没人抄过来的决定。`keep-heads-fresh` 就是这么来的。

## 注意

上面的时间是代理自己报的。`/doc-diet:check` 只测你问到的东西。精简版本身对不对，没有工具替你查，得自己读。

名字相近的：`agent-md-refactor`（softaworks/agent-toolkit）也拆文档，但边拆边删，不验证。`claude-token-diet`（MUKE-coder）是一组省 token 的设置。claude-mem、Mem0 和 Hindsight 存的是聊天，不是文档。

MIT.
