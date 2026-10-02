[English](README.md) · [한국어](README.ko.md) · [日本語](README.ja.md) · **简体中文**

# doc-diet 🥗

喂给 AI 代理或 Claude 当上下文的知识文件（比如 `CLAUDE.md`），用着用着是不是越来越长，根本停不下来？

我当时做的项目，光领域文档就有 11 份，最大的一份超过 4,400 行。子代理哪怕只做一件小事，也得先把这份长文档从头读到尾。启动慢，token 哗哗地流。

直接删短看着简单，可真要做了摘要，心里就会打鼓：「漏了什么？」「精简版还保留原文的意思吗？」

**`doc-diet` 就是为了这个问题做的。**
把文档瘦身到代理读得动的 150～300 行，同时每一行都能追溯到原文。
原文一个字节不动，原样存成 `<name>.record.md`；代理读的精简版（插件里叫它 head）每一行都标明来自原文哪一节。然后让一个只读过精简版的新代理回答问题，实际验证一下删减有没有丢东西。

## 📦 安装

通过插件市场安装：

```bash
/plugin marketplace add EpsteinKim/doc-diet
/plugin install doc-diet@doc-diet
```

不想安装、想在本地直接试试的话：

```bash
claude --plugin-dir /path/to/doc-diet
```

## ✨ 主要功能

### 1. `split-doc`（拆分文档的技能）

跟 Claude 说「把这份文档拆一下」，这个技能就会启动。
它把原文复制为 `<name>.record.md`，在原文件的位置重新写一份精简版。写完后 `scripts/verify-split.sh` 会跑起来检查两件事：备份和原文是不是完全一样（`cmp`），精简版里反引号括起来的名字（文件名、函数名、配置键）是不是真的存在于原文或你的代码里。说白了，就是看 AI 有没有编出不存在的名字。

### 2. `/doc-diet:check`（遗漏测试）

测试代理只看精简版能不能答对的命令。
一个叫 `doc-tester` 的只读代理只读精简版，然后回答你的问题。每个答案先标上「精简版里有 / 没有 / 不明确」，之后才允许它打开原文（record）和代码，给自己评 right / partial / wrong。

**用法：**

```bash
/doc-diet:check docs/agents/billing.md "退款的基准日是哪天？" "谁可以删除发票？"
```

**输出示例：**

```text
# | question            | in-head | grade | correct answer
1 | 退款基准日           | in-head | right |
2 | 发票删除权限         | not     | wrong | 仅 finance 角色 (record §14)
What the head should have had: 删除权限的规则
```

问题你来给，也可以指一份决策文件让它从里面挑。不给决策文件也能自动出题，打算放在 0.2.0。

*小技巧：拿 AI 以前答错过的边界情况来提问，效果特别好。*

### 3. `keep-heads-fresh`（保持最新的规则）

决策文件变了，精简版也别忘了跟上。三条规则：

1. 把决定写进文档时，同一轮也写进精简版。
2. 结论被证明是错的，在原文里划掉，不要删。
3. 精简版始终保持在 300 行以内。

## 🪝 钩子（Hooks）

代理干活的时候，在后台塞几行上下文给它的钩子。不直接碰文件，需要系统里有 `node`（没有就什么都不做）。

**会话开始时：**

* 项目里有 `.record.md` 文件的话，告诉 Claude「精简版要通读，原文只在顺着 `(record §N)` 找出处时才 grep」。这一条每次开会话都会出现。
* `CLAUDE.md`、`AGENTS.md`、`.claude/` 下的文档太大（默认超过 300 行或 30KB）又没有备份的话，建议「要不要拆一下？」
* 某个精简版自上次测试以来，改过它的提交攒了 5 个以上，就悄悄提醒你跑一下 `/doc-diet:check`。只看前 20 个精简版。

**文档刚被编辑（Edit/Write）之后：**

* 精简版超过行数上限（默认 300 行）就提醒。
* `decisionGlobs` 里指定的决策文件被改了，就提醒 Claude 这一轮把规则也写进精简版。

除了「本项目有精简版」那一行，其余提醒每个会话每个文件只出现一次。跑一次 `/doc-diet:check`，当时的 commit 会写进 `.doc-diet/last-check.json`，提交计数从 0 重新开始。这个文件提交或 gitignore 都行。

## ⚙️ 设置（`.doc-diet.json`）

在项目根目录放一个 `.doc-diet.json` 就能改默认值。所有键都可选，下面是示例（`decisionGlobs` 不设就是空的）。

```json
{
  "recordSuffix": ".record.md",
  "maxHeadLines": 300,
  "bigDocLines": 300,
  "bigDocBytes": 30000,
  "docGlobs": [],
  "decisionGlobs": ["docs/decisions/*.md"],
  "measureAfterCommits": 5
}
```

*想换备份文件的命名规则，把 `recordSuffix` 改成 `.history.md` 或 `.记录.md` 就行。*

## 💡 用下来的感受

放到真实项目里之后，领域代理启动时要读的量**从 440KB 一下掉到 70KB 左右。** 我计时的三份文档，各用 2～5 秒读完。

最有用的是 `/doc-diet:check`。第三轮测试找出了一条摘要时丢掉的例外，还有一条前一天定好、却没人写进精简版的决定。`keep-heads-fresh` 这几条规则就是因为后一件事才有的。

**🚨 注意：** 上面的时间是代理自己报的。而且 `/doc-diet:check` 只检查你问到的问题。精简版本身对不对，没人替你看，最后还是得开发者自己过一遍。

## 🤔 和类似工具的区别

* `agent-md-refactor`（softaworks/agent-toolkit）：也能拆文档，但边整理边删内容，没有验证。
* `claude-token-diet`（MUKE-coder）：与其说是程序，更像一套省 token 的设置。
* claude-mem、Mem0、Hindsight：存的是聊天记录，不是知识文档。

## 📄 License

MIT
