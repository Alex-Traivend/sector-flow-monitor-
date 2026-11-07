const SYMBOLS=['QQQ','RSP','SPY','SOXX','XLK','XLV','XLF','XLI','XLE','XLU','XLP','XLB','XLY','XLC'];
export default async function handler(req,res){
  res.setHeader('Cache-Control','s-maxage=3600, stale-while-revalidate=600');
  const key=process.env.TWELVE_DATA_API_KEY;
  if(!key)return res.status(503).json({error:'API-Schlüssel noch nicht konfiguriert'});
  try{
    const results=[];
    // Sequential requests respect the free tier's low per-minute credit allowance.
    for(const symbol of SYMBOLS){
      const url=new URL('https://api.twelvedata.com/time_series');
      url.searchParams.set('symbol',symbol);url.searchParams.set('interval','1day');url.searchParams.set('outputsize','26');url.searchParams.set('apikey',key);
      const response=await fetch(url);const data=await response.json();
      if(data.status==='error'||!Array.isArray(data.values)){results.push({symbol,error:data.message||'Keine Daten'});continue;}
      const v=data.values.map(x=>({date:x.datetime,close:Number(x.close)})).filter(x=>Number.isFinite(x.close));
      const change=(n)=>v.length>n?(v[0].close/v[n].close-1)*100:null;
      results.push({symbol,date:v[0]?.date,close:v[0]?.close,day:change(1),week:change(5),month:change(20),history:v.slice(0,21)});
    }
    return res.status(200).json({updatedAt:new Date().toISOString(),results});
  }catch(e){return res.status(502).json({error:'Marktdaten momentan nicht erreichbar'});}
}
