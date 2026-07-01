export default () => ({
  port: parseInt(process.env.PORT || '3000', 10),
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },
  agnes: {
    apiKey: process.env.AGNES_API_KEY || '',
    model: process.env.AGNES_MODEL || 'agnes-2.0-flash',
    baseUrl: process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1',
  },
  sms: {
    provider: process.env.SMS_PROVIDER || 'dev',
  },
});
