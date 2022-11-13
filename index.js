// Cloudflare supports the GET, POST, HEAD, and OPTIONS methods from any origin,
// and allow any header on requests. These headers must be present
// on all responses to all CORS preflight requests. In practice, this means
// all responses to OPTIONS requests.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Allow-Headers': '*',
};
const API_URL = 'https://api-v2-mainnet.paras.id'
// The URL for the remote third party API you want to fetch from
// but does not implement CORS
// /api/activities/top-users?__limit=30
// The endpoint you want the CORS reverse proxy to be on
const PROXY_ENDPOINT = '/api/';

// The rest of this snippet for the demo page


async function handleRequest(event) {
  let request = event.request;
  const url = new URL(request.url);
  console.log("URL:" + url);
  let apiUrl = url.searchParams.get('apiurl');
  console.log(url.searchParams);
  if (apiUrl == null) {
    apiUrl = API_URL;
  }

  let data;

  //const pathName = url.pathname;
  let { pathname, search } = url;
  let path = pathname.replace("/api", "");
  const destinationURL = apiUrl + path + search;
  let cacheHit = null;
  const cacheUrl = url;

  // Construct the cache key from the cache URL
  const cacheKey = path + search;//new Request(cacheUrl.toString(), request);
  const cache = caches.default;
  let response = await KV_NEARHIGHLIGHTS.get(cacheKey);

  
  //console.log(`cache: ${response}`);
  
  if (!response) {
    console.log(
      `Response for request url: ${destinationURL} not present in cache. Fetching and caching request.`
    );
    cacheHit = 0
    
    // If not in cache, get it from origin
    //console.log("destinationURL:" + destinationURL);
    // Rewrite request to point to API URL. This also makes the request mutable
    // so you can add the correct Origin header to make the API server think
    // that this request is not cross-site.
    request = new Request(destinationURL, request);
    request.headers.set('Origin', new URL(destinationURL).origin);
    //console.log("headers: " +  JSON.stringify(request.headers))
    response = await fetch(request);

    // Recreate the response so you can modify the headers
    response = new Response(response.body, response);


    response.headers.set('Cache-Control', 's-maxage=600');
    // Append to/Add Vary header so browser will cache response correctly
    response.headers.set('Cache-Control','private=Set-Cookie');
      // Set CORS headers
    response.headers.set('Access-Control-Allow-Origin', url.origin);
    response.headers.append('Vary', 'Origin');
    //let lolo = response.clone()
    data = await response.json();
    json = JSON.stringify(data);

    response = json;
    //event.waitUntil(cache.put(cacheKey, lolo));
    event.waitUntil(KV_NEARHIGHLIGHTS.put(cacheKey,json, {expirationTtl: 600}));

} else {
  console.log(`Cache hit for: ${request.url}.`);
  cacheHit = 1
}


  return new Response(response,{
  headers: {
    'Content-type': 'application/json',
    'Cache-Control': 'max-age=600',// Set cache control headers to cache on browser for 10 minutes
    'cacheHit' : cacheHit,
    ...corsHeaders,
  },
  })
}

function handleOptions(request) {
  // Make sure the necessary headers are present
  // for this to be a valid pre-flight request
  let headers = request.headers;
  if (
    headers.get('Origin') !== null &&
    headers.get('Access-Control-Request-Method') !== null &&
    headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Handle CORS pre-flight request.
    // If you want to check or reject the requested method + headers
    // you can do that here.
    let respHeaders = {
      ...corsHeaders,
      // Allow all future content Request headers to go back to browser
      // such as Authorization (Bearer) or X-Client-Name-Version
      'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers'),
    };

    return new Response(null, {
      headers: respHeaders,
    });
  } else {
    // Handle standard OPTIONS request.
    // If you want to allow other HTTP Methods, you can do that here.
    return new Response(null, {
      headers: {
        Allow: 'GET, HEAD, POST, OPTIONS',
      },
    });
  }
}

addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  console.log(url.pathname);
  if (url.pathname.includes(PROXY_ENDPOINT)) {
    console.log("YES")
    if (request.method === 'OPTIONS' ) {
      // Handle CORS preflight requests
      event.respondWith(handleOptions(request));
    } else if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'POST') {
      // Handle requests to the API server
      event.respondWith(handleRequest(event));
      //console.log(handleRequest(request));
    } else {
      event.respondWith(
        new Response(null, {
          status: 405,
          statusText: 'ERROR',
        })
      );
    }
  } else {
    // Serve demo page
    event.respondWith(
      new Response(null, {
        status: 405,
        statusText: 'ERROR',
      })
    );
  }
});
