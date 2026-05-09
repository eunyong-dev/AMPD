/**
 * Gmail API 를 통한 이메일 발송 유틸.
 * 사용자의 OAuth access_token (provider_token) 으로 본인 Gmail 계정에서 발송.
 */

interface SendArgs {
  accessToken: string;
  from: string; // 보내는 사람 (사용자 자신)
  to: string[]; // 받는 사람 (한 명 이상)
  cc?: string[];
  bcc?: string[];
  subject: string;
  bodyHtml: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

interface SendResult {
  messageId: string;
  threadId: string;
}

/**
 * 쉼표 / 세미콜론 구분 문자열을 이메일 배열로 파싱
 */
export function parseEmails(input: string | null | undefined): string[] {
  if (!input) return [];
  return input
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * RFC 2047 인코딩 — 한글 등 비ASCII 헤더에 사용
 */
function encodeHeader(s: string): string {
  // ASCII만 있으면 그대로
  // eslint-disable-next-line no-control-regex
  if (/^[\x00-\x7F]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, 'utf-8').toString('base64')}?=`;
}

function base64UrlEncode(buf: Buffer): string {
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * RFC 5322 + multipart MIME 메시지 빌드
 */
function buildMimeMessage(args: SendArgs): Buffer {
  const boundary = `=_AMPD_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const lines: string[] = [];

  lines.push(`From: ${encodeHeader(args.from)}`);
  lines.push(`To: ${args.to.join(', ')}`);
  if (args.cc && args.cc.length > 0) {
    lines.push(`Cc: ${args.cc.join(', ')}`);
  }
  if (args.bcc && args.bcc.length > 0) {
    lines.push(`Bcc: ${args.bcc.join(', ')}`);
  }
  lines.push(`Subject: ${encodeHeader(args.subject)}`);
  lines.push('MIME-Version: 1.0');

  const hasAttachment = !!(args.attachments && args.attachments.length > 0);

  if (hasAttachment) {
    lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    lines.push('');
    // HTML body part
    lines.push(`--${boundary}`);
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(
      Buffer.from(args.bodyHtml, 'utf-8')
        .toString('base64')
        .replace(/.{76}/g, '$&\r\n')
    );
    lines.push('');

    // Attachments
    for (const att of args.attachments!) {
      lines.push(`--${boundary}`);
      lines.push(
        `Content-Type: ${att.contentType}; name="${encodeHeader(att.filename)}"`
      );
      lines.push(
        `Content-Disposition: attachment; filename="${encodeHeader(
          att.filename
        )}"`
      );
      lines.push('Content-Transfer-Encoding: base64');
      lines.push('');
      lines.push(att.content.toString('base64').replace(/.{76}/g, '$&\r\n'));
      lines.push('');
    }
    lines.push(`--${boundary}--`);
  } else {
    lines.push('Content-Type: text/html; charset="UTF-8"');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('');
    lines.push(
      Buffer.from(args.bodyHtml, 'utf-8')
        .toString('base64')
        .replace(/.{76}/g, '$&\r\n')
    );
  }

  return Buffer.from(lines.join('\r\n'), 'utf-8');
}

/**
 * Gmail API 호출 — users/me/messages/send
 */
export async function sendViaGmail(args: SendArgs): Promise<SendResult> {
  const mime = buildMimeMessage(args);
  const raw = base64UrlEncode(mime);

  const res = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${args.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gmail API ${res.status}: ${errText}`);
  }

  const data = (await res.json()) as { id: string; threadId: string };
  return { messageId: data.id, threadId: data.threadId };
}
