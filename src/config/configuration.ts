export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'selfpraise-dev-secret',
    refreshSecret:
      process.env.JWT_REFRESH_SECRET || 'selfpraise-dev-refresh-secret',
    /** 默认 30 分钟；开发/生产一致，过期后走 refreshToken */
    accessExpiresInSeconds: parseInt(
      process.env.JWT_ACCESS_EXPIRES_SECONDS || '1800',
      10,
    ),
    /** 默认 180 天 */
    refreshExpiresInSeconds: parseInt(
      process.env.JWT_REFRESH_EXPIRES_SECONDS || String(60 * 60 * 24 * 180),
      10,
    ),
  },
  agnes: {
    apiKey: process.env.AGNES_API_KEY || '',
    model: process.env.AGNES_MODEL || 'agnes-2.0-flash',
    baseUrl: process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1',
  },
  /**
   * 可选 LLM 网关（LiteLLM Proxy）。
   * 设置 LLM_BASE_URL 后走网关（多源 fallback）；未设置则直连 Agnes。
   */
  llm: {
    baseUrl: process.env.LLM_BASE_URL || '',
    apiKey: process.env.LLM_API_KEY || process.env.LITELLM_MASTER_KEY || '',
    model: process.env.LLM_MODEL || 'hugme-agnes',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'dev',
  },
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'admin123',
    jwtSecret: process.env.JWT_ADMIN_SECRET || 'selfpraise-admin-dev-secret',
    expiresInSeconds: parseInt(
      process.env.JWT_ADMIN_EXPIRES_SECONDS || String(60 * 60 * 8),
      10,
    ),
  },
});
