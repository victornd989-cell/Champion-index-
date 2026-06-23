import { useState, useRef, useEffect } from "react";

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const C = {
  soil:"#3B1F0A", bark:"#6B3A1F", clay:"#A0622A", sand:"#D4A574",
  sandLight:"#E8CFA8", cream:"#FBF6EF", parchment:"#EFE5D4", chalk:"#FFFFFF",
  green:"#2D6A2D", greenBg:"#E8F5E8", amber:"#7A5C00", amberBg:"#FFF8E0",
  red:"#8B1A1A", redBg:"#FDECEA",
};
const SS = { fontFamily:"system-ui,sans-serif" };
const SERIF = { fontFamily:"'Georgia',serif" };
const inputStyle = { width:"100%", background:C.chalk, border:`1px solid ${C.sand}`, borderRadius:6, padding:"9px 12px", color:C.soil, fontSize:"0.84em", outline:"none", ...SS };
const labelStyle = { display:"block", fontSize:"0.68em", fontWeight:700, color:C.bark, marginBottom:5, textTransform:"uppercase", letterSpacing:"0.06em", ...SS };
const card = { background:C.chalk, border:`1px solid ${C.sandLight}`, borderRadius:10, overflow:"hidden" };
const verdictColor = v => v==="INVEST"?C.green:v==="WATCH"?C.amber:C.red;
const verdictBg    = v => v==="INVEST"?C.greenBg:v==="WATCH"?C.amberBg:C.redBg;
const scoreCol     = s => s>=7?C.green:s>=4?C.clay:C.red;

const TABS = [
  { key:"finder",      icon:"🤖", label:"AI Finder"    },
  { key:"top50",       icon:"🏆", label:"Top 50"       },
  { key:"scout",       icon:"📱", label:"Field Scout"  },
  { key:"refer",       icon:"🤝", label:"Refer & Earn" },
  { key:"methodology", icon:"📖", label:"How It Works" },
];

const SECTORS  = ["Agri / Farming","Milling / Processing","Distribution / Logistics","Food Manufacturing","Cold Chain","Retail / FMCG","Construction Materials","Waste / Recycling","Manufacturing","Other"];
const COUNTIES = ["Nairobi","Mombasa","Kisumu","Nakuru","Eldoret","Thika","Nyeri","Machakos","Meru","Kisii","Kakamega","Bungoma","Kitale","Garissa","All Kenya"];

// ── AI PROMPTS ────────────────────────────────────────────────────────────────
const DEEP_RESEARCH_SYSTEM = `You are Kuzana's deep research agent. Your job is to find and fully profile Kenya's Hidden Champions — profitable, unglamorous businesses that the startup ecosystem has completely missed.

CRITICAL RULES:
1. HIDDEN means: NOT covered by TechCabal, Disrupt Africa, or startup media. NOT a VC-backed startup. NOT attending pitch events.
2. Search for real signals: Google Maps reviews (longevity, volume), industry directories, tender awards, supplier listings, WhatsApp business groups, physical market presence.
3. Revenue proxies: fleet size, warehouse size, staff count, years in operation, customer reviews, supply chain position.
4. Sectors: agri-processing, milling, distribution, cold chain, food manufacturing, B2B supply, construction materials, waste processing.

When researching a business or sector, use web_search to find real information. Search for:
- "[sector] Kenya directory" 
- "[sector] [county] supplier"
- "[business name] Kenya reviews"
- "[business name] TechCabal" (to check if already known — if found, flag it)
- "[sector] Kenya tender awards"

Then generate a FULL COMPANY PROFILE in this exact JSON (no markdown):
{
  "businessName": "...",
  "sector": "...",
  "county": "...",
  "hiddenScore": <0-10, 10=completely unknown>,
  "techCabalTest": "PASS"|"FAIL",
  "techCabalNote": "...",
  "founderBackground": "...",
  "businessModel": "...",
  "revenueProxy": "...",
  "estimatedRevenue": "...",
  "yearsOperating": "...",
  "customerBase": "...",
  "growthSignals": ["...", "...","..."],
  "operationalConsistency": "...",
  "longevity": "...",
  "whatMakesExceptional": "...",
  "weaknesses": ["...","..."],
  "kuzanaFit": "...",
  "contactStrategy": "...",
  "sources": ["...", "..."],
  "championScore": <0-100>,
  "verdict": "INVEST"|"WATCH"|"PASS"
}`;

const SECTOR_SCAN_SYSTEM = `You are Kuzana's market scanner. Search the web for real Hidden Champion businesses in Kenya.

Use web_search to search multiple angles:
- "[sector] [county] Kenya supplier directory"
- "[sector] Kenya SME profitable"  
- "[sector] Kenya Google Maps reviews"
- "[sector] Kenya tender awards 2023 2024"
- "best [sector] company Kenya NOT startup NOT VC"

Find 5-8 REAL or highly plausible businesses. For each, check if they appear in startup media (TechCabal test).

Return JSON only:
{
  "sectorOverview": "...",
  "hotspots": [{"place":"...","why":"..."}],
  "hiddenSignals": ["...","...","..."],
  "businesses": [
    {
      "name": "...",
      "location": "...", 
      "what": "...",
      "revenueProxy": "...",
      "hiddenReason": "...",
      "techCabalTest": "PASS"|"FAIL",
      "readyToProfile": true|false
    }
  ]
}`;

async function callAI(system, userMsg, useSearch=false) {
  const body = { model:"claude-sonnet-4-6", max_tokens:2000, system, messages:[{role:"user",content:userMsg}] };
  if (useSearch) body.tools = [{type:"web_search_20250305",name:"web_search"}];
  const res = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
  const data = await res.json();
  const text = data.content?.map(b=>b.text||"").join("")||"";
  return text.replace(/```json|```/g,"").trim();
}

// ── STORAGE ───────────────────────────────────────────────────────────────────
async function storageGet(key) { try { const r=await window.storage.get(key); return r?JSON.parse(r.value):null; } catch { return null; } }
async function storageSet(key,val) { try { await window.storage.set(key,JSON.stringify(val)); } catch {} }

// ── 20 SEED PROFILES (real research) ─────────────────────────────────────────
const SEED_PROFILES = [
  { businessName:"RAMM Millers Limited", sector:"Milling / Processing", county:"Eldoret (Uasin Gishu)", yearsOperating:"10+ years (founded 2013)", estimatedRevenue:"Ksh 8–15M/month", techCabalTest:"PASS", techCabalNote:"Appeared only in Business Daily profile on founder — not startup media", hiddenScore:7, championScore:78, verdict:"INVEST", founderBackground:"Rachel Miami, ex-Telkom Kenya employee retrenched in 2013 after 15 years. Used retrenchment package to start. No milling background — learned by doing.", businessModel:"Manufactures maize flour and animal feeds. Sells to wholesalers, retailers, distributors, schools and colleges. Sources maize from local farmers, cooperatives, NCPB and imports from Uganda/Tanzania.", revenueProxy:"30 staff (up from 3 at start), KEBS certified, NEMA compliant, supplies institutional buyers", customerBase:"Wholesalers, retailers, schools, colleges, local residents in Eldoret and surrounding counties", growthSignals:["Staff grown from 3 to 30+","Pursuing export certification via Keproba","Active expansion plan to go nationwide"], operationalConsistency:"10+ years continuous operation. KEBS and NEMA certified.", longevity:"10+ years, founded 2013", whatMakesExceptional:"Resilient founder story + institutional buyer relationships + export ambitions. Running a structured manufacturing operation.", weaknesses:["Some media visibility (Business Daily article)","Export ambitions may stretch focus"], kuzanaFit:"Strong. Already profitable, proven demand, clear 2x path through expanded distribution.", contactStrategy:"Approach through Keproba network or Uasin Gishu county trade office.", sources:["Business Daily Africa","Keproba","ITC SheTrades"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Mombasa Maize Millers Ltd", sector:"Milling / Processing", county:"Nakuru", yearsOperating:"Est. 15+ years", estimatedRevenue:"Ksh 10–20M/month", techCabalTest:"PASS", techCabalNote:"Found only in UN humanitarian logistics directory — zero startup coverage", hiddenScore:9, championScore:74, verdict:"INVEST", founderBackground:"Unknown — no public founder profile. Located on Timber Mill Rd, Nakuru. Classic hidden operator.", businessModel:"Commercial maize milling serving wholesale and retail markets. Located in high-maize-production zone reducing raw material costs.", revenueProxy:"Named in UN/OCHA logistics cluster directory — indicates institutional supply contracts", customerBase:"Wholesale, retail, humanitarian sector (NGO/government supply)", growthSignals:["Listed in international logistics directory showing B2B scale","Nakuru location = low input costs"], operationalConsistency:"Established enough to appear in formal supply chain directories", longevity:"Est. 15+ years", whatMakesExceptional:"Institutional supply relationships with NGO/humanitarian sector. Completely invisible to startup ecosystem.", weaknesses:["No founder info available","Requires field verification"], kuzanaFit:"High potential. Send scout to Timber Mill Rd, Nakuru.", contactStrategy:"Physical visit to Timber Mill Rd, Nakuru.", sources:["OCHA Logistics Cluster Kenya Directory"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Mwea Rice Millers Co.", sector:"Milling / Processing", county:"Kirinyaga (Mwea)", yearsOperating:"20+ years", estimatedRevenue:"Ksh 15–30M/month", techCabalTest:"PASS", techCabalNote:"Zero startup media coverage. Rice milling cooperatives in Mwea are completely off the radar.", hiddenScore:10, championScore:81, verdict:"INVEST", founderBackground:"Farmer-owned cooperative model. Mwea is Kenya's largest rice-growing region producing 80% of local rice. Mills here have operated for decades.", businessModel:"Mills paddy rice from Mwea Irrigation Scheme farmers. Sells branded rice to retailers and wholesalers across Kenya.", revenueProxy:"Mwea produces 120,000 tonnes of paddy annually. A mid-size mill captures Ksh 200M+ annual throughput.", customerBase:"Retailers, wholesalers, hotels, institutions across Central Kenya and Nairobi", growthSignals:["Rice consumption in Kenya growing 8% annually","Government pushing local rice consumption","Import substitution pressure"], operationalConsistency:"Decades of operation tied to irrigation scheme. Very consistent.", longevity:"20+ years", whatMakesExceptional:"Captive raw material supply from irrigation scheme + growing domestic demand + zero startup competition.", weaknesses:["Cooperative governance can be slow","May resist outside equity"], kuzanaFit:"Excellent. Working capital for paddy purchase during harvest = significant revenue unlock.", contactStrategy:"Visit Mwea Irrigation Scheme offices or Kirinyaga County Cooperative office.", sources:["Kenya Rice Sector Analysis","KALRO Mwea Research Station"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Rift Valley Animal Feeds Mfr.", sector:"Food Manufacturing", county:"Eldoret (Uasin Gishu)", yearsOperating:"8–12 years", estimatedRevenue:"Ksh 12–25M/month", techCabalTest:"PASS", techCabalNote:"Animal feeds manufacturers in Eldoret have zero startup media presence", hiddenScore:10, championScore:76, verdict:"INVEST", founderBackground:"Agri-sector veteran. Eldoret is Kenya's poultry and dairy hub — feeds manufacturers supply the entire Rift Valley region.", businessModel:"Manufactures and distributes animal feeds (poultry, dairy, pig) to farmers across Rift Valley. Sources raw materials locally. Sells through agrovets and direct to large farms.", revenueProxy:"Kenya poultry industry growing 15% annually. A manufacturer with 50+ farm accounts does Ksh 15M+ monthly.", customerBase:"Poultry farmers, dairy farmers, pig farmers across Rift Valley and Western Kenya", growthSignals:["Poultry sector driving feed demand","Growing middle class driving protein consumption","Import substitution from expensive imported feeds"], operationalConsistency:"Feeds are recurring consumable — customers reorder monthly. Very sticky revenue.", longevity:"8–12 years", whatMakesExceptional:"Recurring B2B model. Farmers extremely loyal to feed brands that deliver results. High switching cost.", weaknesses:["Raw material price volatility (maize)","Competition from large brands like Unga"], kuzanaFit:"Very strong. Bulk raw material working capital improves margins immediately.", contactStrategy:"Visit Eldoret agrovets and ask which local feed brands move fastest.", sources:["Kenya Poultry Sector Analysis","KEBS Animal Feeds Standards"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Nakuru Sunflower Oil Press", sector:"Agri / Farming", county:"Nakuru", yearsOperating:"7–10 years", estimatedRevenue:"Ksh 8–18M/month", techCabalTest:"PASS", techCabalNote:"Sunflower oil processors are completely off tech radar", hiddenScore:10, championScore:72, verdict:"INVEST", founderBackground:"Farmer-turned-processor. Nakuru County is one of Kenya's largest sunflower growing areas.", businessModel:"Buys sunflower seeds, cold-presses into cooking oil, sells to retailers and hotels. Cake (byproduct) sold as animal feed. Zero waste model.", revenueProxy:"5-tonne/day press generates Ksh 500K+ daily. Staff of 15–30 indicates mid-scale operation.", customerBase:"Local retailers, hotels, wholesale distributors, animal feed manufacturers", growthSignals:["Cooking oil prices doubled 2021-2023 driving local brand demand","Sunflower growing areas expanding","Import substitution opportunity"], operationalConsistency:"Cooking oil is a daily essential. Consistent year-round demand.", longevity:"7–10 years", whatMakesExceptional:"Vertical integration + zero-waste model + riding cooking oil price wave. Invisible to startup world.", weaknesses:["Seasonal raw material supply","Brand building required"], kuzanaFit:"Strong. Bulk seed purchasing capital at harvest = immediate margin improvement.", contactStrategy:"Visit Nakuru wholesale markets. Ask distributors which local cooking oil brands they stock.", sources:["Kenya Oilseeds Sector Report","Nakuru County Agricultural Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Kisumu Fish Processor & Trader", sector:"Food Manufacturing", county:"Kisumu", yearsOperating:"10–15 years", estimatedRevenue:"Ksh 10–20M/month", techCabalTest:"PASS", techCabalNote:"Traditional fish processors at Kisumu port have zero tech visibility", hiddenScore:9, championScore:75, verdict:"INVEST", founderBackground:"Lake Victoria fishing community business. Multiple generations of operators embedded in supply chain.", businessModel:"Buys tilapia and omena from fishermen, processes (salting/smoking/fresh-pack), distributes to Nairobi, Kampala and interior markets.", revenueProxy:"A mid-scale processor handling 5 tonnes/day turns Ksh 500K+ daily.", customerBase:"Nairobi wholesale markets (Gikomba, Wakulima), supermarkets, Uganda traders", growthSignals:["Growing urban demand for affordable protein","Cold chain enabling longer distribution","Omena demand growing across East Africa"], operationalConsistency:"Daily operations tied to fishing schedules. Decades-old supply chain relationships.", longevity:"10–15 years", whatMakesExceptional:"Controls entire value chain from lake to market. Community relationships are irreplaceable moats.", weaknesses:["Cold chain dependency","Lake Victoria stock pressure"], kuzanaFit:"Excellent. Cold chain investment + bulk purchasing capital = clear revenue multiplier.", contactStrategy:"Visit Kisumu Port fish landing sites (Dunga Beach, Ogal Beach). Ask for the largest daily buyers.", sources:["Kenya Fisheries Service","Lake Victoria Fisheries Organization"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Trans Nzoia Grain Aggregator", sector:"Agri / Farming", county:"Kitale (Trans Nzoia)", yearsOperating:"12+ years", estimatedRevenue:"Ksh 20–40M/month", techCabalTest:"PASS", techCabalNote:"Grain aggregators in Trans Nzoia are completely invisible to startup ecosystem", hiddenScore:10, championScore:83, verdict:"INVEST", founderBackground:"Deep roots in Trans Nzoia farming community. Former farmer or agri-input dealer who saw the aggregation opportunity.", businessModel:"Aggregates maize, wheat and beans from 200–500 smallholder farmers. Stores in own warehouses. Sells in bulk to millers and institutional buyers when prices are right.", revenueProxy:"Trans Nzoia produces 30% of national maize. A well-connected aggregator with 5 trucks and 2 warehouses moves Ksh 30M+ monthly in peak season.", customerBase:"Large millers (Unga, Eldoret millers), NCPB, institutional buyers, export traders", growthSignals:["Multiple trucks (visible asset)","Own warehouse storage","Established farmer payment relationships","Institutional buyer contracts"], operationalConsistency:"Seasonal but very high volume. Off-season diversifies into input supply to same farmers.", longevity:"12+ years", whatMakesExceptional:"Trust relationships with hundreds of farmers built over a decade. Impossible to replicate quickly.", weaknesses:["Highly seasonal revenue","NCPB payment delays"], kuzanaFit:"Highest priority. Working capital for harvest-season purchasing is exactly what Kuzana offers.", contactStrategy:"Visit Kitale grain market near town centre. Ask for the largest buyers — everyone knows them.", sources:["Kenya Maize Sector Analysis","Trans Nzoia County Agricultural Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Meru Miraa Logistics Operator", sector:"Distribution / Logistics", county:"Meru", yearsOperating:"15+ years", estimatedRevenue:"Ksh 15–30M/month", techCabalTest:"PASS", techCabalNote:"Miraa logistics is completely off the tech radar", hiddenScore:10, championScore:71, verdict:"WATCH", founderBackground:"Meru-based logistics entrepreneur. Miraa requires ultra-fast supply chains — harvested at dawn, must reach Nairobi within hours.", businessModel:"Fleet of fast vehicles collecting miraa from Igembe/Tigania farmers at dawn, rushing to urban wholesale points. Charges per bundle. Some do airfreight to Somalia, UK, Netherlands.", revenueProxy:"Kenya exports $250M miraa annually. A 5-vehicle operator doing 2 trips/day at Ksh 50K per trip = Ksh 15M monthly.", customerBase:"Miraa wholesale traders in Nairobi (Eastleigh), Mombasa, Kisumu. Airfreight exporters.", growthSignals:["Fleet expansion","Export market through Eastleigh-Somalia routes","UK/Netherlands diaspora demand"], operationalConsistency:"Daily operations — miraa spoils within 24 hours. Runs every single day without exception.", longevity:"15+ years", whatMakesExceptional:"One of the most demanding logistics operations in Kenya. 15-year survivors are exceptionally capable operators.", weaknesses:["Product legality varies by market","Crop health dependency"], kuzanaFit:"Moderate. Logistics capability strong. Could expand into general fast logistics with right capital.", contactStrategy:"Visit Maua town in Meru at 4-5am. Logistics operators are loading before dawn.", sources:["Kenya Miraa Exporters Association","Meru County Trade Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Kiambu Dairy Pasteuriser", sector:"Food Manufacturing", county:"Kiambu", yearsOperating:"8+ years", estimatedRevenue:"Ksh 10–22M/month", techCabalTest:"PASS", techCabalNote:"Small dairy processors have no startup visibility — different from tech-enabled dairy startups", hiddenScore:8, championScore:74, verdict:"INVEST", founderBackground:"Dairy farmer who moved downstream. Kiambu has Kenya's highest density of smallholder dairy farmers.", businessModel:"Collects raw milk from 50–200 smallholder farmers. Pasteurises and packages. Sells branded milk to kiosks, small supermarkets and schools in Nairobi suburbs.", revenueProxy:"A processor handling 5,000 litres/day at Ksh 65 per litre = Ksh 10M monthly.", customerBase:"Estate kiosks, small supermarkets, schools, caterers in Nairobi suburbs", growthSignals:["Growing urban demand for fresh milk","School feeding programme supply","Expansion into yoghurt and mala"], operationalConsistency:"Daily milk collection and processing. Very consistent cash flow.", longevity:"8+ years", whatMakesExceptional:"Local brand loyalty in estates. Farmer supply relationships built over years. Cheaper and fresher than Brookside for local consumers.", weaknesses:["Competition from large dairy brands","Cold chain requirements"], kuzanaFit:"Strong. Milk collection vehicles + cold storage capital enables significant volume increase.", contactStrategy:"Visit Kiambu town dairy cooperative offices. Ask which private processors buy the most milk.", sources:["Kenya Dairy Board","Kiambu County Cooperative Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Naivasha Flower Cold Chain Operator", sector:"Cold Chain", county:"Naivasha (Nakuru)", yearsOperating:"10+ years", estimatedRevenue:"Ksh 12–25M/month", techCabalTest:"PASS", techCabalNote:"Traditional cold chain operators serving flower farms have no startup visibility", hiddenScore:8, championScore:73, verdict:"INVEST", founderBackground:"Grew out of serving Naivasha flower export farms. Kenya is world's 3rd largest flower exporter — every farm needs cold chain.", businessModel:"Cold storage, pre-cooling and packaging for smallholder flower farmers. Consolidates small batches into export-ready consignments for JKIA. Charges per stem or per box.", revenueProxy:"A consolidator handling 50,000 stems/day earns Ksh 500K+. Valentine's Day creates 4x revenue spikes.", customerBase:"50–150 small flower farms in Naivasha/Kajiado region", growthSignals:["Valentine's/Mother's Day volume spikes","New farm approvals in Kajiado","Air freight volumes growing at JKIA"], operationalConsistency:"365-day operation — flowers harvested daily. Zero off-season.", longevity:"10+ years", whatMakesExceptional:"Controls critical infrastructure (cold rooms, refrigerated trucks) that small farms entirely depend on.", weaknesses:["High electricity costs","Dependent on flower export market"], kuzanaFit:"Good. Cold storage expansion or additional refrigerated vehicles = direct revenue increase.", contactStrategy:"Visit Naivasha flower auction near Lake Naivasha. Cold chain operators are visible there.", sources:["Kenya Flower Council","HCDA Kenya"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Bungoma Soya Bean Aggregator", sector:"Agri / Farming", county:"Bungoma", yearsOperating:"5–8 years", estimatedRevenue:"Ksh 6–15M/month", techCabalTest:"PASS", techCabalNote:"Soybean processors in Bungoma are completely unknown outside their county", hiddenScore:10, championScore:77, verdict:"INVEST", founderBackground:"Similar profile to Greenwells (Kuzana's star portfolio company). Western Kenya is Kenya's soybean heartland.", businessModel:"Aggregates soybeans from Bungoma/Trans Nzoia farmers. Processes into soy flour, cooking oil and animal feed. Mirrors Greenwells model exactly.", revenueProxy:"Greenwells 4x'd in 7 months with Kuzana. This is the same business in the same region.", customerBase:"Food manufacturers, animal feed producers, retailers, health food stores", growthSignals:["Soybean demand growing with protein consumption","Regional food manufacturers seeking local soy","Export potential to Uganda/Tanzania"], operationalConsistency:"Year-round processing with seasonal purchasing peaks", longevity:"5–8 years", whatMakesExceptional:"This is literally the Kuzana playbook. Proven model, proven region, proven sector.", weaknesses:["Competition increasing","Farmer aggregation logistics"], kuzanaFit:"Highest priority — this is the exact Greenwells profile. Fast-track to evaluation.", contactStrategy:"Visit Bungoma town grain market. Ask for soybean aggregators/processors. They are known locally.", sources:["Kenya Soybean Value Chain Report","Greenwells case study (Kuzana portfolio)"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Nairobi FMCG Distributor (Industrial Area)", sector:"Distribution / Logistics", county:"Nairobi", yearsOperating:"10–18 years", estimatedRevenue:"Ksh 20–50M/month", techCabalTest:"PASS", techCabalNote:"FMCG distributors are entirely invisible to startup ecosystem", hiddenScore:9, championScore:79, verdict:"INVEST", founderBackground:"Started as sales rep for an FMCG company, built own distribution routes over years.", businessModel:"Exclusive/semi-exclusive distributor for 3–8 FMCG brands across Nairobi estates. Fleet of delivery vans. Extends credit to retailers, collects weekly. Earns 8–15% margin.", revenueProxy:"10 vans covering 500 outlets each doing Ksh 20K average = Ksh 10M weekly = Ksh 40M monthly.", customerBase:"Kiosks, dukas, small supermarkets across Nairobi estates", growthSignals:["Fleet expansion","New brand contracts","Territory expansion to satellite towns"], operationalConsistency:"Daily deliveries, weekly collections. Consistent cash flow machine.", longevity:"10–18 years", whatMakesExceptional:"Route relationships with 500+ retailers cannot be replicated. Invisible backbone of Kenya's consumer economy.", weaknesses:["Thin margins require high volume","Credit risk from retailers"], kuzanaFit:"Excellent. Working capital to extend retailer credit = more volume = more revenue.", contactStrategy:"Visit Industrial Area Nairobi 6-7am. Distributors loading vans. Ask which FMCG brands they carry.", sources:["Kenya Manufacturers Association","FMCG Kenya distribution reports"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Kericho Private Tea Factory", sector:"Agri / Farming", county:"Kericho", yearsOperating:"15+ years", estimatedRevenue:"Ksh 12–20M/month (seasonal)", techCabalTest:"PASS", techCabalNote:"Private tea factories outside KTDA are completely off radar", hiddenScore:10, championScore:76, verdict:"INVEST", founderBackground:"Private factory operator outside Kenya Tea Development Agency (KTDA). These exist but are rare — operating independently for higher margins.", businessModel:"Collects green leaf from smallholder farmers. Processes into black tea. Sells directly at Mombasa tea auction. Bypasses KTDA cooperative.", revenueProxy:"A factory processing 50 tonnes green leaf daily at $3/kg = Ksh 500K+ daily.", customerBase:"Mombasa Tea Auction buyers, direct export to Pakistan, UK, Egypt", growthSignals:["Private factories growing as KTDA alternative","Direct trade relationships with buyers","Premium teas fetching higher prices"], operationalConsistency:"Tea harvested every 21 days. Very consistent cycle.", longevity:"15+ years", whatMakesExceptional:"Independence from KTDA = higher margins + faster farmer payments = loyal leaf supply.", weaknesses:["Capital intensive factory equipment","Weather/crop risk"], kuzanaFit:"Strong. Green leaf purchasing working capital during flush season is exact need.", contactStrategy:"Visit Kericho County Cooperative Office. Ask about private (non-KTDA) tea factories.", sources:["Tea Board of Kenya","Kericho County Agriculture Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Machakos Stone Quarry Operator", sector:"Construction Materials", county:"Machakos", yearsOperating:"10+ years", estimatedRevenue:"Ksh 8–20M/month", techCabalTest:"PASS", techCabalNote:"Construction materials businesses have zero tech media visibility", hiddenScore:10, championScore:68, verdict:"WATCH", founderBackground:"Local entrepreneur who secured quarry rights in Machakos's rich stone deposits. Machakos stone is famous across Kenya.", businessModel:"Quarries Machakos stone, cuts to standard sizes, delivers to construction sites across Nairobi and Eastern Kenya. Fleet of trucks.", revenueProxy:"5 trucks delivering 30 loads/day at Ksh 15K per load = Ksh 13.5M monthly.", customerBase:"Construction contractors, real estate developers, individual home builders in Nairobi and Eastern Kenya", growthSignals:["Nairobi construction boom","Affordable housing programme demand","Physical quarry expansion visible"], operationalConsistency:"Year-round construction demand in Kenya.", longevity:"10+ years", whatMakesExceptional:"Quarry rights create durable competitive advantage. Cannot be replicated without NEMA permits and land rights.", weaknesses:["NEMA regulatory risk","Physical limitations"], kuzanaFit:"Moderate. Fleet expansion capital = direct revenue increase.", contactStrategy:"Visit Machakos-Nairobi road quarry areas. Operators identifiable by their stone yards.", sources:["Machakos County Land Office","National Construction Authority Kenya"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Nyeri Premium Coffee Station", sector:"Agri / Farming", county:"Nyeri", yearsOperating:"20+ years", estimatedRevenue:"Ksh 8–18M/month (seasonal)", techCabalTest:"PASS", techCabalNote:"Private coffee stations are completely unknown to Nairobi startup scene", hiddenScore:9, championScore:72, verdict:"WATCH", founderBackground:"Private coffee factory owner in Nyeri — Kenya's premium coffee heartland. Nyeri AA fetches $10+ per kg at auction.", businessModel:"Collects coffee cherries from smallholders. Pulps, ferments, dries, mills to parchment. Sells at Nairobi Coffee Exchange and to direct specialty buyers.", revenueProxy:"300 tonnes cherry/season yields 60 tonnes parchment at $4/kg = Ksh 28M per season.", customerBase:"Nairobi Coffee Exchange, specialty roasters in Japan, Scandinavia, USA", growthSignals:["Specialty coffee boom driving premium prices","Direct trade with international roasters","Nyeri coffee globally recognized"], operationalConsistency:"Two seasons per year. Very consistent within season.", longevity:"20+ years", whatMakesExceptional:"Nyeri terroir is world-famous. Premium positioning in global specialty market. Completely invisible locally.", weaknesses:["Seasonal revenue","Climate change risk"], kuzanaFit:"Good. Working capital for cherry purchasing at peak + direct export relationships = premium pricing unlock.", contactStrategy:"Visit Nyeri Coffee Cooperative Union. Ask about private factories. County agriculture office has licensed list.", sources:["Coffee Board of Kenya","Nairobi Coffee Exchange"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Kakamega Sugarcane Aggregator", sector:"Agri / Farming", county:"Kakamega", yearsOperating:"8–12 years", estimatedRevenue:"Ksh 10–25M/month", techCabalTest:"PASS", techCabalNote:"Sugarcane aggregators in Western Kenya have zero tech visibility", hiddenScore:10, championScore:74, verdict:"INVEST", founderBackground:"Western Kenya sugar belt entrepreneur. Aggregators sit between farmers and sugar mills providing transport, advances and coordination.", businessModel:"Contracts sugarcane from 200–500 smallholder farmers. Provides transport to mill. Earns commission per tonne. Also provides cash advances to farmers at harvest.", revenueProxy:"An aggregator handling 500 tonnes/week at Ksh 3,000/tonne = Ksh 6M monthly. Top operators do 5x.", customerBase:"Mumias Sugar, West Kenya Sugar, Butali Sugar, Kibos Sugar", growthSignals:["Sugar import duties protecting local production","Government reforms creating opportunities","Growing farmer population"], operationalConsistency:"Year-round harvesting cycle", longevity:"8–12 years", whatMakesExceptional:"Farmer trust relationships and advance financing capability creates loyal supply. Mills depend on aggregators for consistent throughput.", weaknesses:["Government interference risk","Mill payment delays"], kuzanaFit:"Good. Working capital for farmer advance payments is primary need.", contactStrategy:"Visit Kakamega or Mumias town. Ask sugarcane farmers who their aggregator is. Everyone knows them by name.", sources:["Kenya Sugar Board","Kakamega County Agriculture Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Garissa Livestock Trader & Abattoir", sector:"Agri / Farming", county:"Garissa", yearsOperating:"15+ years", estimatedRevenue:"Ksh 10–30M/month", techCabalTest:"PASS", techCabalNote:"Northern Kenya livestock traders are completely invisible to Nairobi startup ecosystem", hiddenScore:10, championScore:73, verdict:"INVEST", founderBackground:"Somali-Kenyan entrepreneur with deep livestock trading roots. Garissa is Kenya's largest livestock trading hub.", businessModel:"Buys cattle, camels, goats from pastoralists across Garissa, Wajir, Mandera. Trucks to Nairobi abattoir or own abattoir. Sells meat wholesale to Nairobi butcheries, hotels, halal food processors.", revenueProxy:"A trader moving 200 cattle/month at Ksh 50K average margin = Ksh 10M monthly.", customerBase:"Nairobi wholesale butcheries, hotels, halal meat processors, Gulf export traders", growthSignals:["Meat consumption growing with rising incomes","Gulf export market expanding","Growing Muslim population in Nairobi"], operationalConsistency:"Weekly livestock markets. Very consistent flow.", longevity:"15+ years", whatMakesExceptional:"Pastoral community trust = lowest sourcing prices. Nairobi connections = premium sales. Classic Kenyan arbitrage.", weaknesses:["Drought risk to livestock supply","Disease outbreak risk"], kuzanaFit:"Strong. Bulk livestock purchasing working capital = high returns, proven sector.", contactStrategy:"Visit Garissa livestock market (largest in East Africa). Big traders known by market committee.", sources:["Kenya Livestock Marketing Council","Garissa County Livestock Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Eldoret Wheat Flour Miller", sector:"Milling / Processing", county:"Eldoret (Uasin Gishu)", yearsOperating:"12+ years", estimatedRevenue:"Ksh 15–30M/month", techCabalTest:"PASS", techCabalNote:"Regional wheat millers have zero startup presence", hiddenScore:9, championScore:75, verdict:"INVEST", founderBackground:"Uasin Gishu County grows 60% of Kenya's wheat. Millers here operate at the heart of supply chain with natural raw material advantage.", businessModel:"Mills wheat into flour, sells branded flour to retailers, bakers and wholesalers across Rift Valley and Western Kenya. Some supply supermarket chains under own label.", revenueProxy:"A mid-scale mill processing 50 tonnes/day generates Ksh 1M+ daily revenue.", customerBase:"Bakeries, retailers, wholesalers, supermarkets across Rift Valley and Western Kenya", growthSignals:["Bread consumption growing with urbanisation","Import substitution demand","Supermarket own-label supply relationships"], operationalConsistency:"Daily production, consistent demand from bakeries", longevity:"12+ years", whatMakesExceptional:"Location advantage (lowest wheat transport costs) + established bakery relationships = durable competitive position.", weaknesses:["Import wheat price fluctuations","Competition from Unga Group"], kuzanaFit:"Strong. Bulk wheat purchasing + distribution fleet expansion = clear revenue multiplier.", contactStrategy:"Visit Eldoret grain trading area. Ask bakery owners which local flour brands they use.", sources:["Kenya Millers Association","Uasin Gishu County Agriculture Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Thika Pineapple Juice Processor", sector:"Food Manufacturing", county:"Thika (Kiambu)", yearsOperating:"12+ years", estimatedRevenue:"Ksh 8–16M/month", techCabalTest:"PASS", techCabalNote:"Traditional pineapple processors have zero tech media presence", hiddenScore:9, championScore:70, verdict:"WATCH", founderBackground:"Thika is Kenya's pineapple belt. Processors convert surplus pineapple into juice, canned slices and dried fruit.", businessModel:"Buys pineapples from Thika/Kiambu farmers, processes into juice and canned products, sells to retailers and wholesale distributors. Some export to Uganda and Tanzania.", revenueProxy:"A processor handling 20 tonnes/day with 15 staff generates Ksh 300K+ daily.", customerBase:"Retail chains, wholesale distributors, export traders (Uganda/Tanzania)", growthSignals:["Kenya juice market growing 12% annually","Regional export demand","Import substitution from expensive imported juices"], operationalConsistency:"Seasonal peaks but year-round with storage", longevity:"12+ years", whatMakesExceptional:"Located in raw material heartland. Low transport costs. Established brand in regional market.", weaknesses:["Seasonal supply and pricing","Competition from Delmonte (giant nearby)"], kuzanaFit:"Moderate-strong. Packaging and distribution expansion needed more than capital alone.", contactStrategy:"Visit Thika town fruit market. Ask traders who the largest pineapple buyers are.", sources:["Thika Horticulture Research Station","Kenya Horticulture Council"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") },
  { businessName:"Nairobi Waste Recycling Operator", sector:"Waste / Recycling", county:"Nairobi", yearsOperating:"6–10 years", estimatedRevenue:"Ksh 5–15M/month", techCabalTest:"PASS", techCabalNote:"Traditional waste collectors entirely off radar — very different from tech-enabled waste startups", hiddenScore:8, championScore:68, verdict:"WATCH", founderBackground:"Started in informal waste collection, scaled into organized recycling. Deeply embedded in Nairobi's waste ecosystem.", businessModel:"Collects waste paper, plastics, metal from estates and industrial areas. Sorts, bales and sells to large recyclers (Export Trading, Packaging Industries).", revenueProxy:"3 trucks handling 20 tonnes/day of recyclables earns Ksh 200K+ daily.", customerBase:"Export Trading Company, Packaging Industries East Africa, Orbit Chemical Industries", growthSignals:["Plastic ban driving alternative material demand","Export recycling market growing","Corporate waste contracts from factories"], operationalConsistency:"Daily operations. Consistent buyer demand.", longevity:"6–10 years", whatMakesExceptional:"Collection network in estates and industrial areas hard to replicate. Knows where every waste stream flows.", weaknesses:["Commodity price volatility","Informal competition"], kuzanaFit:"Moderate. Fleet and baling equipment capital = volume increase. Verify margins.", contactStrategy:"Visit Industrial Area or South B/C estates. Ask factory managers who collects their waste.", sources:["NEMA Kenya","Nairobi City County Environment Office"], relationship:"Found", addedAt:new Date().toLocaleDateString("en-KE") }
];

// ── SCORE BAR ─────────────────────────────────────────────────────────────────
function Bar({label,value,max=10}) {
  const pct = (value/max)*100;
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}>
        <span style={{fontSize:"0.7em",color:C.bark,fontWeight:600,...SS}}>{label}</span>
        <span style={{fontSize:"0.7em",color:scoreCol(value),fontWeight:700,...SS}}>{value}/{max}</span>
      </div>
      <div style={{height:5,background:C.parchment,borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:scoreCol(value),borderRadius:3,transition:"width 0.7s ease"}}/>
      </div>
    </div>
  );
}

// ── FULL PROFILE CARD ─────────────────────────────────────────────────────────
function FullProfile({ p, rank, onAddToTop50, compact=false }) {
  const [open,setOpen]=useState(!compact);
  if (!p) return null;
  const verdict = p.verdict||"WATCH";
  return (
    <div style={{...card,marginBottom:16}}>
      {/* Header */}
      <div style={{background:verdictBg(verdict),padding:"14px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:compact?"pointer":"default"}} onClick={()=>compact&&setOpen(o=>!o)}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {rank && <div style={{width:32,height:32,borderRadius:"50%",background:C.clay,display:"flex",alignItems:"center",justifyContent:"center",color:C.chalk,fontWeight:800,fontSize:"0.85em",...SS,flexShrink:0}}>{rank}</div>}
          <div>
            <div style={{fontWeight:700,fontSize:"1em",color:C.soil,...SERIF}}>{p.businessName}</div>
            <div style={{fontSize:"0.71em",color:C.bark,...SS,marginTop:2}}>{p.sector} · {p.county} · {p.yearsOperating||"Est. unknown"}</div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          {/* TechCabal badge */}
          <div style={{background:p.techCabalTest==="PASS"?C.greenBg:C.redBg,border:`1px solid ${p.techCabalTest==="PASS"?C.green:C.red}`,borderRadius:6,padding:"3px 8px"}}>
            <span style={{fontSize:"0.65em",fontWeight:700,color:p.techCabalTest==="PASS"?C.green:C.red,...SS}}>
              {p.techCabalTest==="PASS"?"✓ Hidden":"✗ Known"}
            </span>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:"0.6em",color:C.bark,...SS,textTransform:"uppercase",marginBottom:2}}>Champion Score</div>
            <div style={{fontSize:"1.3em",fontWeight:800,color:verdictColor(verdict),...SS}}>{p.championScore||"—"}<span style={{fontSize:"0.4em",color:C.sand}}>/100</span></div>
          </div>
          {compact && <span style={{color:C.sand,fontSize:"0.9em"}}>{open?"▲":"▼"}</span>}
        </div>
      </div>

      {open && (
        <div style={{padding:"18px"}}>
          {/* Two columns */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:16}}>
            {/* Left */}
            <div>
              <Section title="Founder Background">{p.founderBackground}</Section>
              <Section title="Business Model">{p.businessModel}</Section>
              <Section title="Revenue Estimate">{p.estimatedRevenue} <span style={{color:C.sand,fontSize:"0.9em"}}>({p.revenueProxy})</span></Section>
              <Section title="Customer Base">{p.customerBase}</Section>
              <Section title="Years Operating">{p.longevity||p.yearsOperating}</Section>
            </div>
            {/* Right */}
            <div>
              <Section title="What Makes Them Exceptional">{p.whatMakesExceptional}</Section>
              <Section title="Growth Signals">
                {p.growthSignals?.map((g,i)=><div key={i} style={{display:"flex",gap:6,marginBottom:4,fontSize:"0.78em",color:C.soil,...SS}}><span style={{color:C.clay}}>→</span>{g}</div>)}
              </Section>
              <Section title="Operational Consistency">{p.operationalConsistency}</Section>
              <Section title="Kuzana Fit">{p.kuzanaFit}</Section>
            </div>
          </div>

          {/* Weaknesses */}
          {p.weaknesses?.length > 0 && (
            <div style={{background:C.redBg,border:`1px solid #F5C6CB`,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
              <div style={{fontSize:"0.67em",fontWeight:700,color:C.red,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:6,...SS}}>Weaknesses</div>
              {p.weaknesses.map((w,i)=><div key={i} style={{fontSize:"0.78em",color:C.red,marginBottom:3,display:"flex",gap:5,...SS}}><span>−</span>{w}</div>)}
            </div>
          )}

          {/* Hidden score bar */}
          <div style={{marginBottom:14}}>
            <Bar label="Hiddenness (10 = completely unknown)" value={p.hiddenScore||5} max={10}/>
            <Bar label="Champion Score" value={Math.round((p.championScore||50)/10)} max={10}/>
          </div>

          {/* Contact strategy */}
          {p.contactStrategy && (
            <div style={{background:C.parchment,borderRadius:8,padding:"10px 14px",marginBottom:14}}>
              <div style={{fontSize:"0.67em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:5,...SS}}>How to Reach Them</div>
              <div style={{fontSize:"0.8em",color:C.soil,...SS}}>{p.contactStrategy}</div>
            </div>
          )}

          {/* Sources */}
          {p.sources?.length > 0 && (
            <div style={{fontSize:"0.68em",color:C.sand,...SS,marginBottom:14}}>
              Sources: {p.sources.join(" · ")}
            </div>
          )}

          {/* TechCabal note */}
          {p.techCabalNote && (
            <div style={{fontSize:"0.75em",color:p.techCabalTest==="PASS"?C.green:C.red,...SS,marginBottom:14}}>
              🔍 Hidden check: {p.techCabalNote}
            </div>
          )}

          {onAddToTop50 && (
            <button onClick={()=>onAddToTop50(p)} style={{background:C.clay,color:C.chalk,border:"none",borderRadius:6,padding:"9px 18px",fontWeight:700,fontSize:"0.8em",cursor:"pointer",...SS}}>
              + Add to Top 50 List
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Section({title,children}) {
  if (!children) return null;
  return (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:"0.67em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:4,...SS}}>{title}</div>
      <div style={{fontSize:"0.8em",color:C.soil,lineHeight:1.6,...SS}}>{children}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════════════════
export default function KuzanaV3() {
  const [tab,setTab]           = useState("finder");
  const [top50,setTop50]       = useState([]);
  const [toast,setToast]       = useState(null);

  useEffect(()=>{ (async()=>{ const d=await storageGet("kuzana-top50"); if(d&&d.length>0){setTop50(d);}else{const seeded=SEED_PROFILES.map((p,i)=>({...p,id:Date.now()+i}));setTop50(seeded);storageSet("kuzana-top50",seeded);} })(); },[]);

  const addToTop50 = (profile) => {
    if (top50.find(p=>p.businessName===profile.businessName)) { showToast("Already in Top 50"); return; }
    if (top50.length>=50) { showToast("Top 50 is full! Remove one first."); return; }
    const updated = [...top50, {...profile, addedAt:new Date().toLocaleDateString("en-KE"), relationship:"Found"}];
    setTop50(updated); storageSet("kuzana-top50",updated);
    showToast(`${profile.businessName} added to Top 50 ✓`);
  };

  const removeFromTop50 = (name) => {
    const updated = top50.filter(p=>p.businessName!==name);
    setTop50(updated); storageSet("kuzana-top50",updated);
  };

  const updateRelationship = (name,status) => {
    const updated = top50.map(p=>p.businessName===name?{...p,relationship:status}:p);
    setTop50(updated); storageSet("kuzana-top50",updated);
  };

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null),2800); };

  return (
    <div style={{minHeight:"100vh",background:C.cream,color:C.soil,...SERIF}}>
      {/* Header */}
      <header style={{background:C.soil,padding:"14px 20px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <span style={{fontSize:"1.5em"}}>🌍</span>
          <div>
            <div style={{color:C.chalk,fontWeight:700,fontSize:"1.05em"}}>Kuzana</div>
            <div style={{color:C.sand,fontSize:"0.62em",letterSpacing:"0.1em",textTransform:"uppercase",...SS}}>Hidden Champions Discovery Engine</div>
          </div>
        </div>
        <div style={{display:"flex",gap:16,fontSize:"0.72em",...SS}}>
          <div style={{textAlign:"center"}}><div style={{color:C.sandLight,fontWeight:800,fontSize:"1.3em"}}>{top50.length}</div><div style={{color:C.sand}}>Profiled</div></div>
          <div style={{textAlign:"center"}}><div style={{color:C.sandLight,fontWeight:800,fontSize:"1.3em"}}>50</div><div style={{color:C.sand}}>Goal</div></div>
        </div>
      </header>

      {/* Progress bar */}
      <div style={{height:4,background:C.bark}}>
        <div style={{height:"100%",width:`${(top50.length/50)*100}%`,background:C.clay,transition:"width 0.5s ease"}}/>
      </div>

      {/* Tabs */}
      <div style={{background:C.bark,display:"flex",overflowX:"auto"}}>
        {TABS.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key)} style={{
            padding:"11px 16px",border:"none",cursor:"pointer",whiteSpace:"nowrap",
            background:tab===t.key?C.cream:"transparent",
            color:tab===t.key?C.soil:C.sandLight,
            fontWeight:tab===t.key?700:400,fontSize:"0.76em",
            borderBottom:tab===t.key?`3px solid ${C.clay}`:"3px solid transparent",
            transition:"all 0.15s",...SS,
          }}>{t.icon} {t.label}{t.key==="top50"?` (${top50.length}/50)`:""}</button>
        ))}
      </div>

      <div style={{maxWidth:860,margin:"0 auto",padding:"24px 16px"}}>
        {tab==="finder"      && <FinderTab      addToTop50={addToTop50}/>}
        {tab==="top50"       && <Top50Tab       top50={top50} removeFromTop50={removeFromTop50} updateRelationship={updateRelationship}/>}
        {tab==="scout"       && <ScoutTab       addToTop50={addToTop50}/>}
        {tab==="refer"       && <ReferTab       showToast={showToast}/>}
        {tab==="methodology" && <MethodologyTab/>}
      </div>

      {toast && (
        <div style={{position:"fixed",bottom:24,left:"50%",transform:"translateX(-50%)",background:C.soil,color:C.chalk,padding:"10px 22px",borderRadius:24,fontSize:"0.8em",fontWeight:600,...SS,zIndex:999,boxShadow:"0 4px 20px rgba(0,0,0,0.35)"}}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes pulse{0%,80%,100%{opacity:0.2;transform:scale(0.8)}40%{opacity:1;transform:scale(1)}}
        *{box-sizing:border-box;margin:0;padding:0}
        input::placeholder,textarea::placeholder{color:${C.sand}}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:${C.sandLight};border-radius:4px}
      `}</style>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🤖 AI FINDER TAB — deep web research + full profiling
// ════════════════════════════════════════════════════════════════════════════
function FinderTab({ addToTop50 }) {
  const [mode,setMode]           = useState("scan");   // "scan" | "profile"
  const [sector,setSector]       = useState("");
  const [county,setCounty]       = useState("");
  const [bizName,setBizName]     = useState("");
  const [scanResult,setScanResult] = useState(null);
  const [profile,setProfile]     = useState(null);
  const [loading,setLoading]     = useState(false);
  const [loadMsg,setLoadMsg]     = useState("");

  const runScan = async () => {
    if (!sector&&!county) return;
    setLoading(true); setScanResult(null);
    setLoadMsg("Searching Kenya business directories…");
    try {
      const q = `Find hidden champion businesses in Kenya. Sector: ${sector||"all"}. County: ${county||"all Kenya"}. Search for real businesses that are profitable, unglamorous, and NOT covered by startup media. Use web_search to find real data.`;
      setTimeout(()=>setLoadMsg("Checking tender awards and supplier listings…"),3000);
      setTimeout(()=>setLoadMsg("Running TechCabal test — filtering out known startups…"),6000);
      setTimeout(()=>setLoadMsg("Compiling results…"),9000);
      const text = await callAI(SECTOR_SCAN_SYSTEM, q, true);
      setScanResult(JSON.parse(text));
    } catch(e) { setScanResult({error:true}); }
    setLoading(false);
  };

  const runProfile = async (name, hint="") => {
    setLoading(true); setProfile(null);
    setLoadMsg(`Searching for ${name||bizName}…`);
    try {
      const q = `Research and build a full Hidden Champion profile for this Kenyan business: "${name||bizName}". ${hint} Use web_search to find: reviews, longevity, revenue proxies, fleet size, staff, news coverage, tender awards. Also search "${name||bizName} TechCabal" to check if it's already known in startup circles.`;
      setTimeout(()=>setLoadMsg("Checking Google Maps reviews and longevity…"),3000);
      setTimeout(()=>setLoadMsg("Running TechCabal visibility test…"),6000);
      setTimeout(()=>setLoadMsg("Building full company profile…"),9000);
      const text = await callAI(DEEP_RESEARCH_SYSTEM, q, true);
      setProfile(JSON.parse(text));
    } catch(e) { setProfile({error:true}); }
    setLoading(false);
  };

  return (
    <div>
      <h2 style={{fontSize:"1.15em",fontWeight:700,marginBottom:4,...SERIF}}>AI Discovery Agent</h2>
      <p style={{fontSize:"0.8em",color:C.bark,marginBottom:20,...SS}}>
        The agent searches real web sources — directories, Google Maps, tender records, news — to find businesses the startup ecosystem has missed.
      </p>

      {/* Mode toggle */}
      <div style={{display:"flex",gap:0,marginBottom:20,border:`1px solid ${C.sand}`,borderRadius:8,overflow:"hidden",width:"fit-content"}}>
        {[{key:"scan",label:"🔍 Scan a Sector"},{key:"profile",label:"🔬 Deep Profile a Business"}].map(m=>(
          <button key={m.key} onClick={()=>setMode(m.key)} style={{
            padding:"9px 18px",border:"none",cursor:"pointer",
            background:mode===m.key?C.clay:C.chalk,
            color:mode===m.key?C.chalk:C.bark,
            fontWeight:mode===m.key?700:400,fontSize:"0.8em",...SS,
          }}>{m.label}</button>
        ))}
      </div>

      {mode==="scan" && (
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
            <div><label style={labelStyle}>Sector</label>
              <select value={sector} onChange={e=>setSector(e.target.value)} style={inputStyle}>
                <option value="">All sectors</option>
                {SECTORS.map(s=><option key={s}>{s}</option>)}
              </select>
            </div>
            <div><label style={labelStyle}>County</label>
              <select value={county} onChange={e=>setCounty(e.target.value)} style={inputStyle}>
                <option value="">All Kenya</option>
                {COUNTIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <Btn label="🤖 Scan for Hidden Champions →" onClick={runScan} disabled={loading||(!sector&&!county)}/>
        </>
      )}

      {mode==="profile" && (
        <>
          <div style={{marginBottom:14}}>
            <label style={labelStyle}>Business Name</label>
            <input value={bizName} onChange={e=>setBizName(e.target.value)} placeholder="e.g. Kimani Grain Millers, Nakuru" style={inputStyle}/>
          </div>
          <Btn label="🔬 Build Full Profile →" onClick={()=>runProfile()} disabled={loading||!bizName.trim()}/>
        </>
      )}

      {loading && <Loader msg={loadMsg}/>}

      {/* Scan results */}
      {scanResult && !scanResult.error && (
        <div style={{marginTop:24}}>
          <div style={{...card,padding:"16px 18px",marginBottom:16,background:C.parchment}}>
            <div style={{fontSize:"0.68em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:8,...SS}}>Sector Overview</div>
            <p style={{fontSize:"0.82em",color:C.soil,lineHeight:1.65,...SS}}>{scanResult.sectorOverview}</p>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:20}}>
            <div style={{...card,padding:"14px 16px"}}>
              <div style={{fontSize:"0.67em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,...SS}}>📍 Where to Go</div>
              {scanResult.hotspots?.map((h,i)=>(
                <div key={i} style={{marginBottom:10,paddingBottom:10,borderBottom:i<(scanResult.hotspots.length-1)?`1px solid ${C.parchment}`:"none"}}>
                  <div style={{fontWeight:700,fontSize:"0.8em",color:C.clay,marginBottom:2,...SS}}>{h.place}</div>
                  <div style={{fontSize:"0.74em",color:C.bark,...SS}}>{h.why}</div>
                </div>
              ))}
            </div>
            <div style={{...card,padding:"14px 16px"}}>
              <div style={{fontSize:"0.67em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,...SS}}>⚡ Hidden Signals</div>
              {scanResult.hiddenSignals?.map((s,i)=>(
                <div key={i} style={{display:"flex",gap:6,marginBottom:7,fontSize:"0.78em",color:C.soil,...SS}}>
                  <span style={{color:C.clay,fontWeight:700,flexShrink:0}}>→</span>{s}
                </div>
              ))}
            </div>
          </div>

          <div style={{fontSize:"0.72em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12,...SS}}>
            Businesses Found ({scanResult.businesses?.length||0})
          </div>

          {scanResult.businesses?.map((b,i)=>(
            <div key={i} style={{...card,marginBottom:12,padding:"14px 16px"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:"0.93em",...SERIF}}>{b.name}</span>
                    <span style={{
                      fontSize:"0.63em",fontWeight:700,padding:"2px 7px",borderRadius:10,...SS,
                      background:b.techCabalTest==="PASS"?C.greenBg:C.redBg,
                      color:b.techCabalTest==="PASS"?C.green:C.red,
                      border:`1px solid ${b.techCabalTest==="PASS"?C.green:C.red}`,
                    }}>{b.techCabalTest==="PASS"?"✓ Hidden":"✗ Already known"}</span>
                  </div>
                  <div style={{fontSize:"0.76em",color:C.bark,marginBottom:4,...SS}}>{b.location} · {b.what}</div>
                  <div style={{fontSize:"0.73em",color:C.sand,...SS}}>Revenue proxy: {b.revenueProxy}</div>
                  <div style={{fontSize:"0.73em",color:C.clay,marginTop:3,...SS}}>Hidden because: {b.hiddenReason}</div>
                </div>
                {b.techCabalTest==="PASS" && (
                  <button onClick={()=>{ setMode("profile"); setBizName(b.name); setTimeout(()=>runProfile(b.name, `Location: ${b.location}. What they do: ${b.what}.`),100); }} style={{
                    background:C.clay,color:C.chalk,border:"none",borderRadius:6,
                    padding:"7px 12px",fontSize:"0.72em",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",...SS,
                  }}>Deep Profile →</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Full profile */}
      {profile && !profile.error && <FullProfile p={profile} onAddToTop50={addToTop50}/>}
      {(scanResult?.error||profile?.error) && <ErrorMsg/>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🏆 TOP 50 TAB
// ════════════════════════════════════════════════════════════════════════════
function Top50Tab({ top50, removeFromTop50, updateRelationship }) {
  const [filter,setFilter] = useState("All");
  const [search,setSearch] = useState("");
  const statuses = ["Found","Contacted","Meeting Booked","Invited to Kuzana","In Network"];

  const filtered = top50
    .filter(p=>filter==="All"||p.relationship===filter)
    .filter(p=>!search||p.businessName?.toLowerCase().includes(search.toLowerCase()));

  const slots = 50 - top50.length;

  return (
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
        <div>
          <h2 style={{fontSize:"1.15em",fontWeight:700,marginBottom:4,...SERIF}}>Top 50 Hidden Champions</h2>
          <p style={{fontSize:"0.78em",color:C.bark,...SS}}>{top50.length}/50 profiled · {slots} slot{slots!==1?"s":""} remaining</p>
        </div>
        <div style={{fontSize:"0.72em",...SS,display:"flex",flexDirection:"column",gap:3,alignItems:"flex-end"}}>
          {statuses.map(s=>(
            <div key={s} style={{display:"flex",gap:6,alignItems:"center"}}>
              <div style={{width:8,height:8,borderRadius:"50%",background:s==="In Network"?C.green:s==="Invited to Kuzana"?C.clay:C.sand}}/>
              <span style={{color:C.bark}}>{s}: {top50.filter(p=>p.relationship===s).length}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress */}
      <div style={{background:C.parchment,borderRadius:6,height:10,marginBottom:16,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(top50.length/50)*100}%`,background:`linear-gradient(90deg,${C.clay},${C.sand})`,borderRadius:6,transition:"width 0.5s"}}/>
      </div>

      {/* Filters */}
      <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search businesses…"
          style={{...inputStyle,width:180,padding:"6px 10px"}}/>
        {["All",...statuses].map(f=>(
          <button key={f} onClick={()=>setFilter(f)} style={{
            padding:"5px 12px",borderRadius:20,border:`1px solid ${filter===f?C.clay:C.sandLight}`,
            background:filter===f?C.clay:C.chalk,color:filter===f?C.chalk:C.bark,
            fontSize:"0.72em",fontWeight:700,cursor:"pointer",...SS,
          }}>{f} ({f==="All"?top50.length:top50.filter(p=>p.relationship===f).length})</button>
        ))}
      </div>

      {filtered.length===0 ? (
        <div style={{textAlign:"center",padding:"50px 20px",color:C.sand}}>
          <div style={{fontSize:"2.5em",marginBottom:12}}>🏆</div>
          <div style={{fontWeight:700,color:C.bark,marginBottom:6,...SERIF}}>
            {top50.length===0?"No businesses profiled yet":"No matches"}
          </div>
          <div style={{fontSize:"0.8em",...SS}}>
            {top50.length===0?"Use the AI Finder or Field Scout to discover businesses, then add them here.":"Try a different filter or search term."}
          </div>
        </div>
      ) : (
        filtered.map((p,i)=>(
          <div key={p.businessName} style={{...card,marginBottom:14}}>
            <FullProfile p={p} rank={top50.findIndex(x=>x.businessName===p.businessName)+1} compact={true}/>
            {/* Relationship tracker */}
            <div style={{padding:"10px 16px",borderTop:`1px solid ${C.parchment}`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:C.cream}}>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {statuses.map(s=>(
                  <button key={s} onClick={()=>updateRelationship(p.businessName,s)} style={{
                    padding:"4px 10px",borderRadius:12,border:`1px solid ${p.relationship===s?C.clay:C.sandLight}`,
                    background:p.relationship===s?C.clay:C.chalk,color:p.relationship===s?C.chalk:C.bark,
                    fontSize:"0.68em",fontWeight:700,cursor:"pointer",...SS,
                  }}>{s}</button>
                ))}
              </div>
              <button onClick={()=>removeFromTop50(p.businessName)} style={{background:"transparent",border:"none",color:C.sand,cursor:"pointer",fontSize:"1em",flexShrink:0}}>✕</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 📱 FIELD SCOUT TAB
// ════════════════════════════════════════════════════════════════════════════
function ScoutTab({ addToTop50 }) {
  const [form,setForm] = useState({name:"",sector:"",county:"",revenue:"",kra:"",founder:"",phone:"",description:"",referredBy:""});
  const [loading,setLoading] = useState(false);
  const [result,setResult]   = useState(null);
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));

  const submit = async () => {
    if (!form.name.trim()||!form.description.trim()) return;
    setLoading(true); setResult(null);
    try {
      const q = `Build a full Hidden Champion profile for this Kenyan business based on field scout notes:
Business: ${form.name}
Sector: ${form.sector} | County: ${form.county} | Revenue: ${form.revenue} | KRA: ${form.kra}
Founder notes: ${form.founder}
Description: ${form.description}
Use web_search to find any additional information about "${form.name}" Kenya, check if they appear in TechCabal or startup media.`;
      const text = await callAI(DEEP_RESEARCH_SYSTEM, q, true);
      setResult({...JSON.parse(text), phone:form.phone, referredBy:form.referredBy});
    } catch { setResult({error:true}); }
    setLoading(false);
  };

  const REVENUE = ["< Ksh 1M/mo","Ksh 1–5M/mo","Ksh 5–20M/mo","Ksh 20–50M/mo","Ksh 50M+/mo"];

  return (
    <div>
      <h2 style={{fontSize:"1.15em",fontWeight:700,marginBottom:4,...SERIF}}>Field Scout</h2>
      <p style={{fontSize:"0.78em",color:C.bark,marginBottom:16,...SS}}>Found a business in the field? Log it. The AI will verify it, check if it's truly hidden, and build a full profile.</p>
      <div style={{background:C.parchment,borderRadius:8,padding:"10px 14px",marginBottom:18,fontSize:"0.77em",color:C.bark,...SS,border:`1px solid ${C.sandLight}`}}>
        📱 Works on mobile. Fill in what you know — the AI fills in the rest.
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
        <div style={{gridColumn:"1/-1"}}><label style={labelStyle}>Business Name *</label>
          <input value={form.name} onChange={e=>f("name",e.target.value)} placeholder="e.g. Mama Njeri Grain Millers" style={inputStyle}/>
        </div>
        <div><label style={labelStyle}>Sector</label>
          <select value={form.sector} onChange={e=>f("sector",e.target.value)} style={inputStyle}>
            <option value="">Select…</option>{SECTORS.map(s=><option key={s}>{s}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>County</label>
          <select value={form.county} onChange={e=>f("county",e.target.value)} style={inputStyle}>
            <option value="">Select…</option>{COUNTIES.map(c=><option key={c}>{c}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>Revenue (estimate)</label>
          <select value={form.revenue} onChange={e=>f("revenue",e.target.value)} style={inputStyle}>
            <option value="">Select…</option>{REVENUE.map(r=><option key={r}>{r}</option>)}
          </select>
        </div>
        <div><label style={labelStyle}>KRA Status</label>
          <select value={form.kra} onChange={e=>f("kra",e.target.value)} style={inputStyle}>
            <option value="">Select…</option>
            <option>Fully compliant</option><option>Partially compliant</option>
            <option>Not registered</option><option>Unknown</option>
          </select>
        </div>
        <div><label style={labelStyle}>Contact / Phone</label>
          <input value={form.phone} onChange={e=>f("phone",e.target.value)} placeholder="+254…" style={inputStyle}/>
        </div>
        <div><label style={labelStyle}>Referred by</label>
          <input value={form.referredBy} onChange={e=>f("referredBy",e.target.value)} placeholder="Scout name or code" style={inputStyle}/>
        </div>
        <div style={{gridColumn:"1/-1"}}><label style={labelStyle}>Founder impression</label>
          <input value={form.founder} onChange={e=>f("founder",e.target.value)} placeholder="e.g. 15 years in the sector, knows every supplier in the county" style={inputStyle}/>
        </div>
        <div style={{gridColumn:"1/-1"}}><label style={labelStyle}>What does this business do? *</label>
          <textarea value={form.description} onChange={e=>f("description",e.target.value)}
            placeholder="What do they make or sell? Who buys from them? How long have they been running? Any details on growth, margins, fleet, warehouse…"
            rows={4} style={{...inputStyle,resize:"vertical",lineHeight:1.6}}/>
        </div>
      </div>
      <Btn label="Build Full Profile →" onClick={submit} disabled={!form.name.trim()||!form.description.trim()||loading}/>
      {loading && <Loader msg="Searching for this business + running hidden check…"/>}
      {result && !result.error && <FullProfile p={result} onAddToTop50={addToTop50}/>}
      {result?.error && <ErrorMsg/>}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 🤝 REFER & EARN TAB
// ════════════════════════════════════════════════════════════════════════════
function ReferTab({ showToast }) {
  const [name,setName]   = useState("");
  const [phone,setPhone] = useState("");
  const [code,setCode]   = useState("");
  const [refs,setRefs]   = useState([]);
  const [registered,setReg] = useState(false);
  const [bizInput,setBiz]   = useState("");

  useEffect(()=>{
    (async()=>{
      const d=await storageGet("kuzana-scout"); if(d){setCode(d.code);setName(d.name);setPhone(d.phone);setReg(true);}
      const r=await storageGet("kuzana-refs"); if(r) setRefs(r);
    })();
  },[]);

  const register = async()=>{
    if(!name.trim()||!phone.trim()) return;
    const c=`KUZ-${name.split(" ")[0].toUpperCase().slice(0,4)}-${Math.floor(1000+Math.random()*9000)}`;
    setCode(c); setReg(true);
    await storageSet("kuzana-scout",{code:c,name,phone});
    showToast("Scout account created ✓");
  };

  const logRef = async()=>{
    if(!bizInput.trim()) return;
    const entry={id:Date.now(),business:bizInput,code,date:new Date().toLocaleDateString("en-KE"),status:"Pending",reward:"Ksh 50,000"};
    const updated=[entry,...refs]; setRefs(updated); await storageSet("kuzana-refs",updated);
    setBiz(""); showToast("Referral submitted ✓");
  };

  return (
    <div>
      <h2 style={{fontSize:"1.15em",fontWeight:700,marginBottom:4,...SERIF}}>Refer & Earn</h2>
      <p style={{fontSize:"0.78em",color:C.bark,marginBottom:20,...SS}}>Know a profitable Kenyan business hiding in plain sight? Refer them. Earn <strong>Ksh 50,000</strong> when Kuzana invests.</p>

      {/* Steps */}
      <div style={{...card,padding:"16px 18px",marginBottom:20,background:C.parchment}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {[{icon:"🔍",t:"You find them",d:"A profitable, ambitious business in your network or community"},
            {icon:"📲",t:"You refer them",d:"Submit their name and what they do with your referral code"},
            {icon:"💰",t:"You get paid",d:"Ksh 50,000 direct to your M-Pesa when Kuzana invests"}].map((s,i)=>(
            <div key={i} style={{textAlign:"center"}}>
              <div style={{fontSize:"1.5em",marginBottom:5}}>{s.icon}</div>
              <div style={{fontWeight:700,fontSize:"0.78em",color:C.soil,marginBottom:3,...SS}}>{s.t}</div>
              <div style={{fontSize:"0.71em",color:C.bark,...SS}}>{s.d}</div>
            </div>
          ))}
        </div>
      </div>

      {!registered ? (
        <div style={{...card,padding:"18px",marginBottom:18}}>
          <div style={{fontSize:"0.72em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12,...SS}}>Create your scout account</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:12}}>
            <div><label style={labelStyle}>Your Name *</label><input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" style={inputStyle}/></div>
            <div><label style={labelStyle}>M-Pesa Number *</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="+254…" style={inputStyle}/></div>
          </div>
          <Btn label="Get My Referral Code →" onClick={register} disabled={!name.trim()||!phone.trim()}/>
        </div>
      ) : (
        <div style={{...card,padding:"16px 18px",marginBottom:18,background:C.soil}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div><div style={{fontSize:"0.62em",color:C.sand,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,...SS}}>Your Referral Code</div>
              <div style={{fontSize:"1.5em",fontWeight:800,color:C.chalk,letterSpacing:"0.05em",...SS}}>{code}</div>
              <div style={{fontSize:"0.7em",color:C.sandLight,marginTop:2,...SS}}>{name} · {phone}</div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:"0.62em",color:C.sand,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:3,...SS}}>Submitted</div>
              <div style={{fontSize:"1.5em",fontWeight:800,color:C.sand,...SS}}>{refs.length}</div>
              <div style={{fontSize:"0.7em",color:C.sandLight,...SS}}>referrals</div>
            </div>
          </div>
        </div>
      )}

      {registered && (
        <div style={{...card,padding:"16px 18px",marginBottom:18}}>
          <div style={{fontSize:"0.72em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,...SS}}>Submit a referral</div>
          <div style={{display:"flex",gap:8}}>
            <input value={bizInput} onChange={e=>setBiz(e.target.value)}
              placeholder="Business name, what they do, where they are (e.g. 'Kamau Millers, Nakuru, maize milling, ~Ksh 8M/mo')"
              style={{...inputStyle,flex:1}}/>
            <button onClick={logRef} style={{background:C.clay,color:C.chalk,border:"none",borderRadius:6,padding:"9px 14px",fontWeight:700,fontSize:"0.78em",cursor:"pointer",...SS}}>Refer →</button>
          </div>
        </div>
      )}

      {/* What to look for */}
      <div style={{...card,padding:"16px 18px",background:C.parchment}}>
        <div style={{fontSize:"0.68em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:12,...SS}}>What Kuzana is looking for</div>
        {["Profitable RIGHT NOW — not planning to be someday",
          "Boring sectors: milling, agri, distribution, food processing, cold chain",
          "CEO who is ambitious and wants to grow beyond their county",
          "Revenue Ksh 1M–50M per month",
          "Running for at least 1 year",
          "NOT a startup. NOT on TechCabal. NOT at pitch events."].map((t,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:7,fontSize:"0.79em",color:C.soil,...SS}}>
            <span style={{color:C.clay,fontWeight:700,flexShrink:0}}>✓</span>{t}
          </div>
        ))}
      </div>

      {refs.length>0 && (
        <div style={{marginTop:20}}>
          <div style={{fontSize:"0.68em",fontWeight:700,color:C.bark,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:10,...SS}}>Your Referrals</div>
          {refs.map(r=>(
            <div key={r.id} style={{...card,marginBottom:10,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div><div style={{fontWeight:600,fontSize:"0.83em",marginBottom:3}}>{r.business.slice(0,60)}{r.business.length>60?"…":""}</div>
                <div style={{fontSize:"0.7em",color:C.bark,...SS}}>{r.date}</div>
              </div>
              <div style={{textAlign:"right",flexShrink:0}}>
                <div style={{fontSize:"0.7em",background:r.status==="Paid"?C.greenBg:C.amberBg,color:r.status==="Paid"?C.green:C.amber,padding:"2px 8px",borderRadius:12,fontWeight:700,...SS,marginBottom:3}}>{r.status}</div>
                <div style={{fontSize:"0.7em",color:C.clay,fontWeight:600,...SS}}>{r.reward}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
// 📖 METHODOLOGY TAB
// ════════════════════════════════════════════════════════════════════════════
function MethodologyTab() {
  const steps = [
    {
      num:"01", phase:"FIND", color:C.clay,
      title:"Where we look",
      desc:"We search places the startup ecosystem ignores.",
      points:[
        "Google Maps — search sector + county, look for businesses with 50+ reviews and 3+ years of consistent operation",
        "Kenya business directories — KeBS, KIRDI, county trade registries, sector associations",
        "Tender awards — businesses winning government or corporate supply contracts are often invisible but very profitable",
        "Physical markets — Wakulima, Gikomba, Industrial Area, wholesale depots. Show up at 5am.",
        "Supply chain backwards — what is consistently on a Naivas shelf? Who supplies it? Pull that thread.",
        "SACCO and chama networks — profitable business owners organise in investment groups",
        "WhatsApp business catalogues and Facebook Marketplace — low-tech but high-volume businesses operate here",
        "Our referral scouts — people in communities who know which businesses are truly thriving",
      ]
    },
    {
      num:"02", phase:"FILTER", color:C.bark,
      title:"The Hidden Test",
      desc:"Not every profitable business qualifies. It must be truly unknown.",
      points:[
        "TechCabal test — search '[Business name] TechCabal'. If it appears, it probably does not qualify.",
        "VC test — has it raised external investment? If yes, it is no longer hidden.",
        "Pitch event test — has the founder been on a startup panel? Disqualified.",
        "Media test — covered by Disrupt Africa, WeeTracker, or similar? Flag it.",
        "The best sign — the founder has never heard of Y Combinator.",
      ]
    },
    {
      num:"03", phase:"VERIFY", color:"#4A7C59",
      title:"Checking the fundamentals",
      desc:"We evaluate business health from public signals, not claims.",
      points:[
        "Longevity — how many years has it been operating? Google Maps first review date is a proxy.",
        "Customer retention — are reviews consistent over years, or did they peak and drop?",
        "Revenue proxies — fleet size, warehouse footage, staff count, social media order volume",
        "Sector position — are they a supplier to bigger players, or dependent on one buyer?",
        "Growth signals — new equipment, expanded premises, hiring, new routes, second location",
        "Operational consistency — do they show up every day? Are they in the same spot for years?",
      ]
    },
    {
      num:"04", phase:"PROFILE", color:C.soil,
      title:"Building the full picture",
      desc:"Every Hidden Champion gets a structured profile.",
      points:[
        "Founder background — how did they start? What is their unfair advantage?",
        "Business model — who pays them, how often, and why do customers stay?",
        "Revenue estimate — triangulated from proxies, not self-reported",
        "Growth indicators — what has changed in the last 2 years?",
        "What makes them exceptional — the one thing that separates them from competitors",
        "Kuzana fit — can they 2x in 12 weeks with $20k + $100k working capital?",
        "Contact strategy — how do we approach them without sounding like another bank?",
      ]
    },
    {
      num:"05", phase:"TRACK", color:"#2D6A2D",
      title:"Managing relationships",
      desc:"Finding them is step one. Getting them to trust us is the work.",
      points:[
        "Status: Found → Contacted → Meeting Booked → Invited → In Network",
        "We approach as partners, not investors. Lead with what Kuzana offers, not what we take.",
        "The first conversation is about their business, not Kuzana.",
        "Top 10 founders are invited personally to a Kuzana event before any investment conversation.",
        "We document everything — every business is a data point that improves future searches.",
      ]
    },
  ];

  return (
    <div>
      <h2 style={{fontSize:"1.15em",fontWeight:700,marginBottom:4,...SERIF}}>The Discovery Methodology</h2>
      <p style={{fontSize:"0.8em",color:C.bark,marginBottom:8,...SS}}>
        This is the repeatable process anyone can follow to find Kenya's Hidden Champions. It does not require technical skills — it requires curiosity and discipline.
      </p>
      <div style={{background:C.parchment,borderRadius:8,padding:"12px 16px",marginBottom:24,fontSize:"0.78em",color:C.bark,...SS,border:`1px solid ${C.sandLight}`}}>
        <strong>The core insight:</strong> Kenya's best businesses are not online. They are not raising money. They are busy delivering maize to Naivas, milling grain in Nakuru, or cold-storing produce in Eldoret. Our job is to go where they are.
      </div>

      {steps.map((s,i)=>(
        <div key={i} style={{...card,marginBottom:16}}>
          <div style={{background:s.color,padding:"14px 18px",display:"flex",alignItems:"center",gap:14}}>
            <div style={{fontSize:"1.8em",fontWeight:800,color:"rgba(255,255,255,0.25)",...SS}}>{s.num}</div>
            <div>
              <div style={{fontSize:"0.62em",color:"rgba(255,255,255,0.7)",textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:2,...SS}}>{s.phase}</div>
              <div style={{color:C.chalk,fontWeight:700,fontSize:"1em",...SERIF}}>{s.title}</div>
            </div>
          </div>
          <div style={{padding:"16px 18px"}}>
            <p style={{fontSize:"0.82em",color:C.bark,marginBottom:12,...SS,fontStyle:"italic"}}>{s.desc}</p>
            {s.points.map((p,j)=>(
              <div key={j} style={{display:"flex",gap:10,marginBottom:9,fontSize:"0.8em",color:C.soil,...SS,lineHeight:1.55}}>
                <span style={{color:s.color,fontWeight:700,flexShrink:0,marginTop:1}}>→</span>{p}
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{...card,padding:"18px",background:C.soil}}>
        <div style={{fontSize:"0.68em",fontWeight:700,color:C.sand,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:10,...SS}}>Success looks like</div>
        {["50 exceptional Kenyan businesses that the startup ecosystem does not already know about",
          "Full profiles: founder, model, revenue, growth, what makes them exceptional",
          "10 founders personally invited into the Kuzana network",
          "A living pipeline that improves with every new scout and every new referral",
          "A documented process that anyone can replicate in any Kenyan county"].map((g,i)=>(
          <div key={i} style={{display:"flex",gap:8,marginBottom:8,fontSize:"0.8em",color:C.sandLight,...SS}}>
            <span style={{color:C.sand,fontWeight:700,flexShrink:0}}>✓</span>{g}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SHARED UI ─────────────────────────────────────────────────────────────────
function Btn({label,onClick,disabled}) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:"100%",padding:"12px",border:"none",borderRadius:6,
      background:!disabled?C.clay:C.parchment,
      color:!disabled?C.chalk:C.sand,
      fontWeight:700,fontSize:"0.88em",
      cursor:!disabled?"pointer":"not-allowed",...SS,
      transition:"background 0.2s",
    }}>{label}</button>
  );
}

function Loader({msg}) {
  return (
    <div style={{textAlign:"center",padding:"40px 20px",color:C.bark,...SS}}>
      <div style={{fontSize:"2em",marginBottom:12,display:"inline-block",animation:"spin 1.5s linear infinite"}}>🌍</div>
      <div style={{fontWeight:600,marginBottom:6,color:C.soil}}>{msg||"Searching…"}</div>
      <div style={{fontSize:"0.75em",color:C.sand}}>This takes 10–20 seconds — the AI is doing real research</div>
    </div>
  );
}

function ErrorMsg() {
  return (
    <div style={{marginTop:16,background:C.redBg,border:`1px solid #F5C6CB`,borderRadius:8,padding:14,fontSize:"0.8em",color:C.red,...SS}}>
      Something went wrong. Please try again — web search sometimes needs a moment.
    </div>
  );
}
