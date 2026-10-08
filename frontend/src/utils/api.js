export async function safeFetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const text = await res.text();
  
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error(`Render server is waking up or starting (${res.status}). Please wait 15 seconds and try again.`);
    }
    if (res.status === 404) {
      throw new Error(`API Endpoint not found (404). Please check VITE_API_URL in Vercel settings.`);
    }
    const snippet = text.slice(0, 100).replace(/<[^>]*>?/gm, '').trim();
    throw new Error(`Server returned HTTP ${res.status}: ${snippet || 'Invalid response'}`);
  }

  if (!res.ok) {
    throw new Error(data.error || data.detail || `Request failed with status ${res.status}`);
  }

  return data;
}
