const CORE_SYMBOLS=['QQQ','RSP','SPY','SOXX','XLK','XLV','XLF','XLI'];
const EXTENDED_SYMBOLS=['XLE','XLU','XLP','XLB','XLY','XLC'];
const STOCK_SYMBOLS=['GEV','CRWD','RKLB','VRTX','FCX'];

export default async function handler(req,res){
  const batch=['extended','stocks'].includes(req.query?.batch)?req.query.batch:'core';
  const symbols=batch==='stocks'?STOCK_SYMBOLS:batch==='extended'?EXTENDED_SYMBOLS:CORE_SYMBOLS;
  const key=process.env.TWELVE_DATA_API_KEY;
  if(!key){
    res.setHeader('Cache-Control','no-store');
    return res.status(503).json({error:'API-Schlüssel noch nicht konfiguriert'});
  }

  try{
    const results=[];
    // Maximal 8 Credits im Kernabruf. Der zweite Batch wird im Browser
    // erst nach 65 Sekunden angefordert. Keine Retries bei API-Limitfehlern.
    for(const symbol of symbols){
      const url=new URL('https://api.twelvedata.com/time_series');
      url.searchParams.set('symbol',symbol);
      url.searchParams.set('interval','1day');
      url.searchParams.set('outputsize','26');
      url.searchParams.set('apikey',key);

      const response=await fetch(url);
      const data=await response.json();
      if(!response.ok||data.status==='error'||!Array.isArray(data.values)){
        results.push({symbol,error:data.message||'Keine Daten verfügbar'});
        continue;
      }

      const values=data.values
        .map(x=>({date:x.datetime,close:Number(x.close)}))
        .filter(x=>Number.isFinite(x.close));
      const change=n=>values.length>n?(values[0].close/values[n].close-1)*100:null;
      results.push({
        symbol,
        date:values[0]?.date,
        close:values[0]?.close,
        day:change(1),
        week:change(5),
        month:change(20),
        history:values.slice(0,21)
      });
    }

    const hasErrors=results.some(x=>x.error);
    // Nur vollständig erfolgreiche Batches eine Stunde am Vercel-Edge cachen.
    res.setHeader('Cache-Control',hasErrors?'no-store':'public, s-maxage=3600, stale-while-revalidate=600');
    return res.status(200).json({
      batch,
      updatedAt:new Date().toISOString(),
      results
    });
  }catch(e){
    res.setHeader('Cache-Control','no-store');
    return res.status(502).json({error:'Marktdaten momentan nicht erreichbar'});
  }
}
