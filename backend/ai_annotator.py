"""AI-powered @viz annotation generator using local LLMs (Ollama / LM Studio).

Provides a unified interface to query local LLMs for automatic @viz annotation
generation from C++ source code.
"""

from __future__ import annotations

import json
import re
import time
from abc import ABC, abstractmethod
from typing import Optional

import httpx

from annotations import Annotation, parse_annotations

# ── HTTP client helper ──────────────────────────────────────────────────────
# On macOS, httpx may bind to IPv6 by default while local LLM servers only
# listen on IPv4, causing 502 errors.  Force IPv4 via local_address.


def _make_client(timeout: float = 60.0) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=timeout,
        transport=httpx.AsyncHTTPTransport(local_address="0.0.0.0"),
    )

# ── Prompt template ────────────────────────────────────────────────────────

SYSTEM_PROMPT_TEMPLATE = """你是一个 C/C++ 数据结构可视化专家。你的任务是分析 C++ 源码，自动生成 @viz 标注。

## @viz 标注规则

@viz 是写在 C++ 注释中的指令，用于控制数据结构可视化引擎。

### 基本语法

1. **数组**: `// @viz array(名称) var=数组变量.length_var=长度变量`
2. **单向链表**: `// @viz linked_list(名称) head=头指针.next_field=next字段名`
3. **双向链表**: `// @viz linked_list(名称) head=头指针.next_field=next字段名.prev_field=prev字段名`
4. **二叉树**: `// @viz binary_tree(名称) root=根指针.left_field=left字段名.right_field=right字段名`
5. **顺序栈**: `// @viz stack(名称) var=数组变量.top_var=栈顶索引变量`
6. **链式栈**: `// @viz stack(名称) var=栈顶指针.next_field=next字段名`
7. **循环队列**: `// @viz queue(名称) var=数组变量.front_var=队首索引.rear_var=队尾索引`
8. **链式队列**: `// @viz queue(名称) var=队首指针.next_field=next字段名`
9. **堆**: `// @viz heap(名称) var=数组变量.length_var=长度变量`
10. **图(邻接矩阵)**: `// @viz graph(名称) var=矩阵变量.mode=matrix.size_var=顶点数变量`
11. **图(邻接表)**: `// @viz graph(名称) var=邻接表变量.size_var=顶点数变量`
12. **哈希表**: `// @viz hashmap(名称) var=表变量.mode=chaining` 或 `mode=open_addressing`
13. **递归树**: `// @viz recursion_tree(名称)`
14. **B树**: `// @viz b_tree(名称) root=根指针.order=阶数`
15. **B+树**: `// @viz bplustree(名称) root=根指针.order=阶数`
16. **指针监视**: `// @viz show(变量1, 变量2, ...)`

### 决策规则

- struct 有 1 个自引用指针字段（如 next）→ 单向链表
- struct 有 2 个自引用指针字段，命名为 prev/next → 双向链表
- struct 有 2 个自引用指针字段，命名为 left/right → 二叉树
- struct 有 keys[] 和 children[] 数组 → B树或B+树
- 一维数组 + 排序/遍历算法（i, j 等循环变量）→ array + @viz show
- 一维数组 + top 变量（push/pop）→ 顺序栈
- 一维数组 + front/rear 变量 → 循环队列
- 一维数组 + heapify → 堆
- 递归函数 → recursion_tree

### 关键约束

- 变量名必须来自源码中真实存在的标识符
- 字段名必须来自 struct 定义中的成员名
- 不要编造不存在的变量或字段
- 典型场景 1-4 条 @viz 即可，不要过度标注

## 输出格式

你必须只输出一个 JSON 对象，不要有任何其他文字：

```json
{
  "annotations": [
    "// @viz linked_list(L) head=head.next_field=next",
    "// @viz show(slow, fast)"
  ],
  "reasoning": "中文说明你的判断依据"
}
```

如果代码中没有可识别的数据结构，返回空的 annotations 数组。
"""

USER_PROMPT_TEMPLATE = """请分析以下 C++ 代码，生成 @viz 标注：

```cpp
{code}
```

返回 JSON："""


# ── Provider abstraction ────────────────────────────────────────────────────


class BaseLLMProvider(ABC):
    """Abstract base for LLM providers."""

    @abstractmethod
    async def chat(self, code: str, system_prompt: str) -> str:
        """Send code to LLM and return raw response text."""
        ...

    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is reachable."""
        ...

    @abstractmethod
    async def list_models(self) -> list[str]:
        """List available models."""
        ...


class OllamaProvider(BaseLLMProvider):
    """Provider for Ollama (local LLM server, default http://localhost:11434)."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:11434",
        model: str = "qwen2.5-coder:3b",
        timeout: float = 60.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    async def chat(self, code: str, system_prompt: str = "") -> str:
        """Send chat request to Ollama generate API."""
        # Auto-select first available model if the configured one isn't found
        model = self.model
        if model != "auto":
            available = await self.list_models()
            if available and model not in available:
                model = available[0]

        full_prompt = f"{system_prompt}\n\n{USER_PROMPT_TEMPLATE.format(code=code)}"

        async with _make_client(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": model,
                    "prompt": full_prompt,
                    "stream": False,
                    "options": {"temperature": 0.1},
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "")

    async def health_check(self) -> bool:
        """Check Ollama server health."""
        try:
            async with _make_client(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                return resp.is_success
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        """List available models from Ollama."""
        try:
            async with _make_client(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/api/tags")
                resp.raise_for_status()
                data = resp.json()
                return [m.get("name", "") for m in data.get("models", [])]
        except Exception:
            return []


class LMStudioProvider(BaseLLMProvider):
    """Provider for LM Studio (OpenAI-compatible API, default http://localhost:1234)."""

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:1234",
        model: str = "auto",
        timeout: float = 60.0,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model  # LM Studio auto-selects loaded model
        self.timeout = timeout

    async def chat(self, code: str, system_prompt: str = "") -> str:
        """Send chat request to LM Studio OpenAI-compatible API."""
        # LM Studio needs a real model ID; fetch first available if set to "auto"
        model = self.model
        if model == "auto":
            models = await self.list_models()
            model = models[0] if models else "auto"
            if model == "auto":
                raise RuntimeError("LM Studio 未加载任何模型")

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": USER_PROMPT_TEMPLATE.format(code=code)},
        ]

        async with _make_client(timeout=self.timeout) as client:
            resp = await client.post(
                f"{self.base_url}/v1/chat/completions",
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.1,
                    "max_tokens": 2048,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]

    async def health_check(self) -> bool:
        """Check LM Studio server health — tries /v1/models, falls back to bare connection."""
        try:
            async with _make_client(timeout=5.0) as client:
                # Try /v1/models (OpenAI-compatible)
                resp = await client.get(f"{self.base_url}/v1/models")
                if resp.is_success:
                    return True
                # Some LM Studio versions don't expose /v1/models — try root
                resp2 = await client.get(self.base_url + "/")
                return resp2.is_success or resp2.status_code < 500
        except Exception:
            return False

    async def list_models(self) -> list[str]:
        """List available models from LM Studio."""
        try:
            async with _make_client(timeout=5.0) as client:
                resp = await client.get(f"{self.base_url}/v1/models")
                resp.raise_for_status()
                data = resp.json()
                return [m.get("id", "") for m in data.get("data", [])]
        except Exception:
            return []


# ── Provider registry ───────────────────────────────────────────────────────

_providers: dict[str, BaseLLMProvider] = {}

def get_provider(name: str) -> Optional[BaseLLMProvider]:
    """Get a provider by name."""
    return _providers.get(name)

def register_provider(name: str, provider: BaseLLMProvider) -> None:
    """Register a provider instance."""
    _providers[name] = provider

def get_all_providers() -> dict[str, BaseLLMProvider]:
    """Get all registered providers."""
    return dict(_providers)

# Initialize default providers
_ollama = OllamaProvider()
_lmstudio = LMStudioProvider()
register_provider("ollama", _ollama)
register_provider("lmstudio", _lmstudio)


# ── Response parser ─────────────────────────────────────────────────────────


def extract_json(text: str) -> Optional[dict]:
    """Extract JSON object from LLM response text.

    Handles markdown code blocks, leading/trailing text, and common formatting.
    """
    # Try direct parse first
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass

    # Try extracting from markdown code block ```json ... ```
    m = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except json.JSONDecodeError:
            pass

    # Try finding JSON object boundaries { ... }
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None


def parse_ai_response(raw_text: str, source_code: str = "") -> dict:
    """Parse LLM response into validated annotations.

    Args:
        raw_text: Raw text from LLM.
        source_code: Original C++ source for variable name validation.

    Returns:
        Dict with 'annotations' (list[str]) and 'reasoning' (str).
        Annotations are validated — invalid ones are dropped with warnings.
    """
    result = {"annotations": [], "reasoning": ""}

    parsed = extract_json(raw_text)
    if not parsed:
        return result

    result["reasoning"] = str(parsed.get("reasoning", ""))
    raw_annotations = parsed.get("annotations", [])

    if not isinstance(raw_annotations, list):
        return result

    # Extract valid identifier names from source code for validation
    valid_names = _extract_identifiers(source_code) if source_code else set()

    for ann_text in raw_annotations:
        if not isinstance(ann_text, str) or not ann_text.strip():
            continue

        ann_text = ann_text.strip()

        # Must start with // @viz or //@viz
        if not (ann_text.startswith("// @viz") or ann_text.startswith("//@viz")):
            continue

        # Try to parse with the existing annotation parser
        parsed_list = parse_annotations(ann_text)
        if not parsed_list:
            continue

        parsed_ann = parsed_list[0]
        # Validate that root_var exists in source code
        root_var = parsed_ann.root_var
        if root_var and valid_names and root_var not in valid_names:
            # root_var might be a deref chain like "head->next" — extract base
            base_var = root_var.split("->")[0].split(".")[0]
            if base_var not in valid_names:
                continue

        result["annotations"].append(ann_text)

    return result


def _extract_identifiers(code: str) -> set[str]:
    """Extract all C++ identifiers from source code for validation."""
    import re
    # Match variable declarations and identifiers
    names: set[str] = set()
    # int/char/float/double + name
    for m in re.finditer(r'\b(?:int|char|float|double|size_t|unsigned|auto)\s+(\w+)', code):
        names.add(m.group(1))
    # Type* name or Type *name
    for m in re.finditer(r'(\w+)\s*\*\s*(\w+)', code):
        names.add(m.group(2))
    # Struct member names
    for m in re.finditer(r'(\w+)\s+(\w+)\s*;', code):
        names.add(m.group(2))
    return names
