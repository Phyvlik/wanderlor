import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) return NextResponse.json({ error: 'lat/lng required' }, { status: 400 });

  const [weatherResult, tzResult] = await Promise.allSettled([
    // wttr.in - free weather, no key needed
    fetch(`https://wttr.in/${lat},${lng}?format=j1`, {
      headers: { 'User-Agent': 'WanderLore/1.0' },
      signal: AbortSignal.timeout(5000),
    }).then(r => r.json()),

    // Google Time Zone API - uses existing Maps key
    fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`,
      { signal: AbortSignal.timeout(5000) }
    ).then(r => r.json()),
  ]);

  // Parse weather
  let weather = { condition: 'Clear', category: 'clear', tempC: '20', humidity: '50', icon: '☀️' };
  if (weatherResult.status === 'fulfilled') {
    try {
      const cond = weatherResult.value.current_condition[0];
      const desc: string = cond.weatherDesc[0].value;
      const d = desc.toLowerCase();
      let category = 'clear';
      let icon = '☀️';
      if (d.includes('thunder') || d.includes('storm'))     { category = 'storm';  icon = '⛈'; }
      else if (d.includes('snow') || d.includes('blizzard')){ category = 'snow';   icon = '❄️'; }
      else if (d.includes('rain') || d.includes('drizzle')) { category = 'rain';   icon = '🌧'; }
      else if (d.includes('fog') || d.includes('mist'))     { category = 'fog';    icon = '🌫'; }
      else if (d.includes('cloud') || d.includes('overcast')){ category = 'cloudy'; icon = '☁️'; }
      weather = { condition: desc, category, tempC: cond.temp_C, humidity: cond.humidity, icon };
    } catch {}
  }

  // Parse timezone
  let timezone = { localTimeStr: '', localHour: 12, isDaytime: true, tzName: '' };
  if (tzResult.status === 'fulfilled' && tzResult.value.status === 'OK') {
    try {
      const tz = tzResult.value;
      const localTs = Math.floor(Date.now() / 1000) + tz.rawOffset + tz.dstOffset;
      const d = new Date(localTs * 1000);
      const h = d.getUTCHours();
      const m = d.getUTCMinutes();
      const ampm = h >= 12 ? 'PM' : 'AM';
      const h12 = h % 12 || 12;
      timezone = {
        localTimeStr: `${h12}:${String(m).padStart(2,'0')} ${ampm}`,
        localHour: h,
        isDaytime: h >= 6 && h < 20,
        tzName: tz.timeZoneName,
      };
    } catch {}
  }

  return NextResponse.json({ weather, timezone });
}
