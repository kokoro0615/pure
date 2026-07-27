#!/usr/bin/env python3
"""
UserPromptSubmit hook: Route to appropriate agent based on user intent.

Routing rules:
- Large codebase analysis → Codex via general-purpose subagent
- Simple codebase orientation → Opus subagent
- External research / survey → Codex via general-purpose subagent
- Multimodal files (PDF/video/audio/image) → Codex via general-purpose subagent
- Non-UI code implementation → Codex via general-purpose subagent
- UI/UX, animation, design, and layout implementation → Opus general-purpose subagent
- Planning, design, complex code → Codex CLI
"""

import json
import sys

MULTIMODAL_EXTENSIONS = (
    ".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg",
    ".mp4", ".mov", ".avi", ".mkv", ".webm",
    ".mp3", ".wav", ".m4a", ".flac", ".ogg",
)

# UI/UX, animation, visual design, and layout implementation must stay with Opus.
UI_IMPLEMENTATION_TRIGGERS = {
    "ja": [
        "ui/ux", "uiux", "フロントエンド", "画面", "見た目",
        "アニメーション", "デザイン", "レイアウト", "css", "tailwind",
    ],
    "en": [
        "ui/ux", "uiux", "frontend", "front-end", "screen", "visual",
        "animation", "motion", "design", "layout", "css", "tailwind",
    ],
}

# Triggers for Codex (planning, design, debugging, complex implementation)
CODEX_TRIGGERS = {
    "ja": [
        "設計", "どう設計", "アーキテクチャ",
        "計画", "計画を立てて",
        "なぜ動かない", "エラー", "バグ", "デバッグ",
        "どちらがいい", "比較して", "トレードオフ",
        "実装方法", "どう実装",
        "リファクタリング", "リファクタ",
        "レビュー",
        "考えて", "分析して", "深く",
        "最適化",
    ],
    "en": [
        "design", "architecture", "architect",
        "plan", "planning",
        "debug", "error", "bug", "not working", "fails",
        "compare", "trade-off", "tradeoff", "which is better",
        "how to implement", "implementation", "complex",
        "refactor", "simplify",
        "review", "check this",
        "think", "analyze", "deeply",
        "optimize", "performance",
    ],
}

# Triggers for simple Opus codebase orientation
OPUS_RESEARCH_TRIGGERS = {
    "ja": [
        "簡単に把握", "簡単にコードベース", "簡単なコードベース",
        "軽く把握", "ざっくり把握", "概要を把握", "軽いコードベース",
    ],
    "en": [
        "quick orientation", "brief codebase overview", "simple codebase",
        "quickly understand", "light codebase scan",
    ],
}

# Triggers for Codex-owned research, large analysis, multimodal, and non-UI implementation
CODEX_RESEARCH_TRIGGERS = {
    "ja": [
        "調べて", "リサーチ", "調査", "サーベイ", "アンケート",
        "最新", "ドキュメント", "ライブラリ", "パッケージ",
        "コードベース", "リポジトリ", "全体構造", "完全なコードベース",
        "理解して", "把握して", "分析して",
        "pdf", "画像", "動画", "音声", "マルチモーダル",
        "実装して", "修正して", "作って", "追加して",
    ],
    "en": [
        "research", "investigate", "look up", "find out", "survey",
        "latest", "documentation", "docs", "library", "package", "framework",
        "codebase", "repository", "project structure", "full codebase",
        "understand", "analyze the code",
        "pdf", "image", "video", "audio", "multimodal",
        "implement", "fix", "build", "add",
    ],
}

# Triggers for Codex Plugin commands (review, rescue, delegation)
CODEX_PLUGIN_TRIGGERS = {
    "ja": [
        "レビューして", "コードレビュー", "レビューお願い",
        "チェックして", "出荷前",
        "codexに任せ", "codexに渡", "codexに委",
        "バグ調査", "調査して",
    ],
    "en": [
        "review this", "code review", "review my",
        "before shipping", "pre-ship",
        "delegate to codex", "hand to codex", "ask codex to",
        "codex rescue", "codex review",
    ],
}


def detect_agent(prompt: str) -> tuple[str | None, str]:
    """Detect which agent should handle this prompt.

    Returns (agent, trigger).
    """
    prompt_lower = prompt.lower()

    # UI/UX, animation, visual design, and layout implementation must be Opus-owned.
    for triggers in UI_IMPLEMENTATION_TRIGGERS.values():
        for trigger in triggers:
            if trigger in prompt_lower:
                return "opus-ui", trigger

    # Multimodal file references are Codex-owned.
    for extension in MULTIMODAL_EXTENSIONS:
        if extension in prompt_lower:
            return "codex-research", extension

    # Codex triggers (planning, design, debug, complex code)
    for triggers in CODEX_TRIGGERS.values():
        for trigger in triggers:
            if trigger in prompt_lower:
                return "codex", trigger

    # Simple codebase orientation can stay with Opus.
    for triggers in OPUS_RESEARCH_TRIGGERS.values():
        for trigger in triggers:
            if trigger in prompt_lower:
                return "opus-research", trigger

    # Codex-owned research, large analysis, multimodal, and non-UI implementation.
    for triggers in CODEX_RESEARCH_TRIGGERS.values():
        for trigger in triggers:
            if trigger in prompt_lower:
                return "codex-research", trigger

    # Codex Plugin triggers (review, rescue, delegation)
    for triggers in CODEX_PLUGIN_TRIGGERS.values():
        for trigger in triggers:
            if trigger in prompt_lower:
                return "codex-plugin", trigger

    return None, ""


def main():
    try:
        data = json.load(sys.stdin)
        prompt = data.get("prompt", "")

        # Skip short prompts
        if len(prompt) < 10:
            sys.exit(0)

        agent, trigger = detect_agent(prompt)

        if agent == "codex":
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": (
                        f"[Agent Routing] Detected '{trigger}' — this task may benefit from "
                        "Codex CLI for planning, design, or complex implementation. Consider: "
                        "`codex exec --model \"${CODEX_MODEL:-gpt-5.5}\" --config model_reasoning_effort=\\\"high\\\" --sandbox read-only "
                        '"{task description}"` for design decisions, planning, debugging, '
                        "or complex analysis."
                    )
                }
            }
            print(json.dumps(output))

        elif agent == "codex-plugin":
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": (
                        f"[Codex Plugin] Detected '{trigger}' — consider using Codex Plugin commands. "
                        "Available: `/codex:review` (code review), "
                        "`/codex:adversarial-review` (design challenge), "
                        "`/codex:rescue` (task delegation). "
                        "Add `--background` for async execution, check with `/codex:status`."
                    )
                }
            }
            print(json.dumps(output))

        elif agent == "opus-ui":
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": (
                        f"[Opus UI/UX Implementation] Detected '{trigger}' — UI/UX, "
                        "animation, visual design, and layout implementation must be "
                        "handled by an Opus general-purpose subagent. Do not route this "
                        "implementation work to Codex unless it is only a planning consultation."
                    )
                }
            }
            print(json.dumps(output))

        elif agent == "codex-research":
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": (
                        f"[Codex Delegation] Detected '{trigger}' — route this task through "
                        "a general-purpose subagent that calls Codex. Codex owns large codebase "
                        "analysis, external research/surveys, multimodal file analysis, and code "
                        "implementation except UI/UX, animation, design, and layout work. "
                        "Save detailed outputs to .claude/docs/research/."
                    )
                }
            }
            print(json.dumps(output))

        elif agent == "opus-research":
            output = {
                "hookSpecificOutput": {
                    "hookEventName": "UserPromptSubmit",
                    "additionalContext": (
                        f"[Opus Orientation] Detected '{trigger}' — a general-purpose Opus "
                        "subagent can handle simple codebase orientation. Escalate to Codex for "
                        "large analysis, external research, multimodal files, or implementation."
                    )
                }
            }
            print(json.dumps(output))

        sys.exit(0)

    except Exception as e:
        print(f"Hook error: {e}", file=sys.stderr)
        sys.exit(0)


if __name__ == "__main__":
    main()
