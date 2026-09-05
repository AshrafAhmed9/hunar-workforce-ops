from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    hunar_api_key: str = ""
    hunar_base_url: str = "https://api.voice.hunar.ai/external/v1"
    database_url: str = "sqlite:///./hunar.db"
    wfo_namespace: str = "wfo-local"
    webhook_max_age_seconds: int = 300
    pdl_api_key: str = ""
    frontend_origin: str = "http://localhost:3000"
    public_api_url: str = ""
    rate_limit_per_minute: int = 60

    def require_hunar(self) -> None:
        if not self.hunar_api_key:
            raise RuntimeError("HUNAR_API_KEY is required for provider operations")


@lru_cache
def get_settings() -> Settings:
    return Settings()
