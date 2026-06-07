
export const handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: 'OK' };
  }

  const SUPA_URL = process.env.SUPABASE_URL;
  const SUPA_KEY = process.env.SUPABASE_SERVICE_KEY;

  if (!SUPA_URL || !SUPA_KEY) {
    return { statusCode: 500, headers: corsHeaders, body: 'Missing Supabase configuration' };
  }

  const prefix = '/.netlify/functions/supabase-proxy';
  const path = event.path.startsWith(prefix) ? event.path.slice(prefix.length) : event.path;
  const query = event.rawQueryString ? '?' + event.rawQueryString : '';
  const upstreamUrl = SUPA_URL + path + query;

  const headers = {
    'apikey': SUPA_KEY,
    'Authorization': 'Bearer ' + SUPA_KEY,
    'Content-Type': event.headers['content-type'] || event.headers['Content-Type'] || 'application/json'
  };

  // Forward only calls to known Supabase routes
  if (!path.startsWith('/rest/v1/') && !path.startsWith('/auth/v1/')) {
    return { statusCode: 400, headers: corsHeaders, body: 'Invalid supabase endpoint' };
  }

  try {
    const res = await fetch(upstreamUrl, {
      method: event.httpMethod,
      headers,
      body: ['GET', 'HEAD', 'OPTIONS'].includes(event.httpMethod) ? undefined : event.body
    });

    const responseText = await res.text();
    const responseHeaders = {
      ...corsHeaders,
      'Content-Type': res.headers.get('content-type') || 'application/json'
    };

    return {
      statusCode: res.status,
      headers: responseHeaders,
      body: responseText
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Supabase proxy request failed', details: error.message })
    };
  }
};
