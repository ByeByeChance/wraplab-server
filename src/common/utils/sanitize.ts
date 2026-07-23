/**
 * Lightweight XSS sanitization for free-text fields.
 * Strips HTML tags and escapes special characters.
 * Decodes pre-existing HTML entities first to prevent double-encoding
 * (e.g. "&amp;" -> "&amp;amp;").
 */
export function sanitizeText(input: string | null | undefined): string | null {
  if (input == null) return null;
  // Decode existing HTML entities to prevent double-encoding
  const decoded = input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'");
  // Strip HTML tags, then re-encode all special characters
  return decoded
    .replace(/<[^>]*>/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Mask WeChat openid for logging.
 * Output format: first 4 chars + '****' + last 4 chars, or '****' if too short.
 */
export function maskWechatOpenId(openid: string | null | undefined): string {
  if (!openid) return '<null>';
  if (openid.length <= 8) return '****';
  return openid.slice(0, 4) + '****' + openid.slice(-4);
}
