import secrets
from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "vasudevan.ai API"
    api_prefix: str = "/api"

    # storage
    database_url: str = "sqlite+aiosqlite:///./vasudevan.db"
    redis_url: str = "redis://redis:6379/0"
    qdrant_url: str = "http://qdrant:6333"
    qdrant_collection: str = "vasudevan-knowledge"
    upload_dir: str = "/app/uploads"

    # LLM
    anthropic_api_key: str | None = None
    llm_chat_model: str = "claude-haiku-4-5-20251001"
    llm_agent_model: str = "claude-sonnet-4-6"

    # embeddings
    embed_model: str = "BAAI/bge-small-en-v1.5"  # fastembed default, 384-dim
    embed_dim: int = 384

    # admin auth
    session_cookie_name: str = "admin_session"
    session_ttl_days: int = 30
    # HMAC secret used to sign 2FA challenge tokens. Read from env if set,
    # otherwise auto-generated at import time — regenerating on restart just
    # invalidates in-flight 5-minute 2FA challenges, which is acceptable.
    secret_key: str = secrets.token_urlsafe(48)
    # Set to true in production to send Secure cookies (HTTPS only).
    cookie_secure: bool = False

    # contact-form notifications (all optional — set whatever you want)
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    notify_email_to: str | None = None  # where contact messages land
    notify_webhook_url: str | None = None  # Slack / Discord / generic JSON POST

    cors_origins: list[str] = [
        "http://localhost:4000",
        "http://127.0.0.1:4000",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
