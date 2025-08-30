// Simple smoke test: login + upload PDF using fetch + FormData
const baseUrl = process.env.API_BASE_URL || 'http://localhost:3000';

function makePdfBuffer() {
  const header = Buffer.from('%PDF-');
  const content = Buffer.from(`Smoke PDF ${Date.now()}\n`);
  return Buffer.concat([header, content]);
}

async function main() {
  const ridLogin = `smoke-login-${Date.now()}`;
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-request-id': ridLogin },
    body: JSON.stringify({ identifier: 'admin@local.test', password: 'Admin@123' }),
  });
  const loginBody = await loginRes.json().catch(() => ({}));
  console.log('LOGIN', loginRes.status, loginBody);
  if (!loginRes.ok) process.exit(1);

  const token = loginBody.accessToken;
  const form = new FormData();
  form.append('title', `Smoke Test ${new Date().toISOString()}`);
  const pdf = makePdfBuffer();
  const blob = new Blob([pdf], { type: 'application/pdf' });
  form.append('file', blob, 'demo.pdf');

  const ridUpload = `smoke-upload-${Date.now()}`;
  const upRes = await fetch(`${baseUrl}/admin/documents`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-request-id': ridUpload },
    body: form,
  });
  const text = await upRes.text();
  console.log('UPLOAD STATUS', upRes.status);
  console.log('UPLOAD HEADERS', {
    location: upRes.headers.get('location'),
    etag: upRes.headers.get('etag'),
    xRequestId: upRes.headers.get('x-request-id'),
    contentType: upRes.headers.get('content-type'),
  });
  console.log('UPLOAD BODY', text);
}

main().catch((e) => {
  console.error('SMOKE ERROR', e);
  process.exit(1);
});
