"""AI annotation API endpoints.

POST /api/ai/annotate  — generate @viz annotations from C++ code
GET  /api/ai/providers  — list available LLM providers
"""

from fastapi import APIRouter
from pydantic import BaseModel

from ai_annotator import (
    _make_client,
    get_all_providers,
    get_provider,
    parse_ai_response,
    SYSTEM_PROMPT_TEMPLATE,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


class AnnotateRequest(BaseModel):
    code: str
    provider: str = "ollama"
    model: str | None = None  # None = use provider default


class AnnotateResponse(BaseModel):
    ok: bool
    annotations: list[str]
    reasoning: str
    error: str = ""


class ProviderInfo(BaseModel):
    name: str
    connected: bool
    models: list[str]
    error: str = ""


@router.post("/annotate", response_model=AnnotateResponse)
async def annotate(req: AnnotateRequest):
    """Generate @viz annotations from C++ source code using a local LLM.

    The code is sent to the specified provider along with a system prompt
    that describes the @viz annotation syntax.  The LLM response is parsed
    and validated — only syntactically-correct annotations are returned.
    """
    provider = get_provider(req.provider)
    if provider is None:
        return AnnotateResponse(
            ok=False,
            annotations=[],
            reasoning="",
            error=f"Unknown provider: {req.provider}. Valid: ollama, lmstudio",
        )

    # Check provider health
    if not await provider.health_check():
        return AnnotateResponse(
            ok=False,
            annotations=[],
            reasoning="",
            error=(
                f"无法连接到 {req.provider} (127.0.0.1)。"
                "请确认本地服务已启动（Ollama :11434，LM Studio :1234）。"
            ),
        )

    # Set model: use request model if provided, otherwise keep provider default
    if req.model:
        provider.model = req.model

    try:
        raw_response = await provider.chat(req.code, SYSTEM_PROMPT_TEMPLATE)
    except Exception as e:
        return AnnotateResponse(
            ok=False,
            annotations=[],
            reasoning="",
            error=f"LLM 请求失败: {str(e)}",
        )

    result = parse_ai_response(raw_response, req.code)

    return AnnotateResponse(
        ok=True,
        annotations=result["annotations"],
        reasoning=result.get("reasoning", ""),
    )


@router.get("/providers", response_model=list[ProviderInfo])
async def list_providers():
    """List registered LLM providers with health status and available models."""
    providers = get_all_providers()
    result: list[ProviderInfo] = []

    for name, provider in providers.items():
        connected = await provider.health_check()
        models = await provider.list_models() if connected else []
        error = ""
        if not connected:
            try:
                async with _make_client(timeout=3.0) as client:
                    await client.get(provider.base_url + "/")
            except Exception as e:
                error = str(e)
        result.append(ProviderInfo(
            name=name,
            connected=connected,
            models=models,
            error=error,
        ))

    return result
