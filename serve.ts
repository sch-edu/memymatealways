const root = new URL('./dist/public/', import.meta.url);
const indexUrl = new URL('index.html', root);

function safePath(pathname: string): URL {
  const requested = pathname.replace(/^\/+/, '');
  const candidate = new URL(requested || 'index.html', root);
  if (!candidate.pathname.startsWith(root.pathname)) return indexUrl;
  return candidate;
}

Deno.serve(async (request) => {
  const fileUrl = safePath(new URL(request.url).pathname);
  try {
    const contentType = fileUrl.pathname.endsWith('.html')
      ? 'text/html; charset=utf-8'
      : fileUrl.pathname.endsWith('.css')
        ? 'text/css; charset=utf-8'
        : fileUrl.pathname.endsWith('.js')
          ? 'application/javascript; charset=utf-8'
          : 'application/octet-stream';
    return new Response(await Deno.readFile(fileUrl), { headers: { 'content-type': contentType } });
  } catch {
    return new Response(await Deno.readFile(indexUrl), {
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }
});