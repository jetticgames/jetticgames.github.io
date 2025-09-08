// Durable Object Rate Limiter (token bucket) placeholder
export class RateLimiter {
  constructor(state, env){
    this.state = state;
    this.env = env;
    this.bucket = { tokens: 0, lastRefill: Date.now() };
  }
  async fetch(request){
    const url = new URL(request.url);
    if(url.pathname === '/check'){
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const limit = 100; // requests per minute
      const refillRate = limit / 60; // tokens per second
      const storageKey = `ip:${ip}`;
      let data = await this.state.storage.get(storageKey);
      if(!data){ data = { tokens: limit, last: Date.now() }; }
      const now = Date.now();
      const elapsed = (now - data.last)/1000;
      data.tokens = Math.min(limit, data.tokens + elapsed*refillRate);
      data.last = now;
      if(data.tokens < 1){
        await this.state.storage.put(storageKey, data);
        return new Response(JSON.stringify({ allowed:false, retryAfter:1 }), {status:429, headers:{'Content-Type':'application/json'}});
      }
      data.tokens -= 1;
      await this.state.storage.put(storageKey, data);
      return new Response(JSON.stringify({ allowed:true, remaining: Math.floor(data.tokens) }), {status:200, headers:{'Content-Type':'application/json'}});
    }
    return new Response('Not found', {status:404});
  }
}