/**
 * 归一化路径，避免雪花/UUID 等动态段打爆 Prometheus label。
 * 例：GET /api/v1/admin/users/123 → GET:/api/v1/admin/users/:id
 */
export function normalizeRoute(method: string, rawPath: string): string {
  const path = (rawPath || '/').split('?')[0] || '/';
  const normalized = path
    .replace(/\/\d{15,}/g, '/:id')
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      '/:id',
    )
    .replace(/\/\d+/g, '/:id');
  return `${(method || 'GET').toUpperCase()}:${normalized}`;
}
