import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { orgNumber } = await req.json();

    if (!orgNumber || typeof orgNumber !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Organization number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanOrgNumber = orgNumber.replace(/\D/g, '');

    // This endpoint fetches an external site on the caller's behalf; keep the
    // input to a strict 10-digit Swedish org number so it can't be used to
    // proxy arbitrary requests through allabolag.se.
    if (!/^\d{10}$/.test(cleanOrgNumber)) {
      return new Response(
        JSON.stringify({ error: 'Invalid organization number format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Looking up company: ${cleanOrgNumber}`);

    // Fetch from allabolag.se
    const url = `https://www.allabolag.se/${cleanOrgNumber}`;
    console.log(`Fetching from: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'sv-SE,sv;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
      },
      redirect: 'follow',
    });

    console.log(`Response status: ${response.status}`);
    console.log(`Final URL: ${response.url}`);

    if (!response.ok) {
      console.log(`Failed to fetch: ${response.status}`);
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const html = await response.text();
    console.log(`HTML length: ${html.length}`);
    
    // Extract company name from title or h1
    let companyName = '';
    
    // Try to get from og:title meta tag
    const ogTitleMatch = html.match(/<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i);
    if (ogTitleMatch) {
      companyName = ogTitleMatch[1].split(' - ')[0].trim();
      console.log(`Found name from og:title: ${companyName}`);
    }
    
    // Fallback to title tag
    if (!companyName) {
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      if (titleMatch) {
        companyName = titleMatch[1].split(' - ')[0].split('|')[0].trim();
        console.log(`Found name from title: ${companyName}`);
      }
    }

    // Check if we got redirected to search page (company not found)
    if (response.url.includes('/sok') || response.url.includes('search') || !companyName || companyName.toLowerCase().includes('sök')) {
      console.log('Company not found - redirected to search');
      return new Response(
        JSON.stringify({ error: 'Company not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract address from JSON-LD structured data
    let address = 'Adress ej tillgänglig';
    const jsonLdMatch = html.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.address) {
          const addr = jsonLd.address;
          if (typeof addr === 'object') {
            const parts = [addr.streetAddress, addr.postalCode, addr.addressLocality].filter(Boolean);
            if (parts.length > 0) {
              address = parts.join(', ');
              console.log(`Found address from JSON-LD: ${address}`);
            }
          }
        }
      } catch {
        console.log('Failed to parse JSON-LD');
      }
    }
    
    // Fallback: look for address in specific HTML patterns
    if (address === 'Adress ej tillgänglig') {
      // Look for address near "Adress" or "Besöksadress" labels
      const addrMatch = html.match(/(?:Besöksadress|Postadress|Adress)[^<]*<[^>]*>([^<]{10,100})</i);
      if (addrMatch && !addrMatch[1].match(/^\d{6}-?\d{4}$/)) {
        address = addrMatch[1].trim();
        console.log(`Found address from HTML: ${address}`);
      }
    }

    // Extract legal form
    let legalForm = 'Aktiebolag';
    const legalFormPatterns = [
      /Bolagsform[:\s]*<[^>]*>([^<]+)/i,
      /Företagsform[:\s]*<[^>]*>([^<]+)/i,
      /"legalForm"[:\s]*"([^"]+)"/i,
    ];
    for (const pattern of legalFormPatterns) {
      const match = html.match(pattern);
      if (match && match[1].trim()) {
        legalForm = match[1].trim();
        console.log(`Found legal form: ${legalForm}`);
        break;
      }
    }

    // Extract SNI/branch info - avoid template placeholders
    let sniCode = '';
    let sniDescription = '';
    
    // Look for SNI in JSON-LD or structured patterns
    const sniMatch = html.match(/SNI[:\s-]*(\d{2}\.?\d{0,3})[^<]*([A-Za-zÀ-ÖØ-öø-ÿ\s,]+)/i);
    if (sniMatch) {
      sniCode = sniMatch[1];
      // Clean up description - remove template placeholders
      const desc = sniMatch[2]?.trim();
      if (desc && !desc.includes('{{') && desc.length > 3) {
        sniDescription = desc;
      }
      console.log(`Found SNI: ${sniCode} - ${sniDescription}`);
    }
    
    // Try to get industry description from meta or other sources
    if (!sniDescription) {
      const industryMatch = html.match(/(?:Bransch|Verksamhet|Huvudbransch)[:\s]*<[^>]*>([^<]{5,100})</i);
      if (industryMatch) {
        const desc = industryMatch[1].trim();
        if (!desc.includes('{{') && !desc.includes('groupId')) {
          sniDescription = desc;
          console.log(`Found industry: ${sniDescription}`);
        }
      }
    }
    
    if (!sniDescription) {
      sniDescription = 'Ej klassificerad';
    }

    const companyInfo = {
      name: companyName,
      legalForm: legalForm,
      address: address,
      sniCode: sniCode,
      sniDescription: sniDescription,
    };

    console.log('Company info:', JSON.stringify(companyInfo));

    return new Response(
      JSON.stringify(companyInfo),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
