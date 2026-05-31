import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name       = searchParams.get('name') || 'Unknown Landmark';
  const era        = searchParams.get('era')  || 'Unknown Era';
  const lat        = searchParams.get('lat')  || '0';
  const lng        = searchParams.get('lng')  || '0';
  const discoverer = searchParams.get('discoverer') || 'Anonymous';
  const ts         = searchParams.get('ts') || String(Date.now());

  const shortAddr = `${discoverer.slice(0, 4)}...${discoverer.slice(-4)}`;
  const discovered = new Date(Number(ts)).toISOString().split('T')[0];

  // Satellite map image of the landmark location
  const imageUrl = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=16&size=400x400&maptype=satellite&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY}`;

  const metadata = {
    name: `WanderLore: ${name}`,
    symbol: 'WLORE',
    description: `A landmark discovered in WanderLore by operative ${shortAddr}. Era: ${era}. Coordinates: ${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}.`,
    image: imageUrl,
    external_url: 'https://wanderlore.io',
    attributes: [
      { trait_type: 'Landmark',   value: name },
      { trait_type: 'Era',        value: era },
      { trait_type: 'Discoverer', value: shortAddr },
      { trait_type: 'Discovered', value: discovered },
      { trait_type: 'Latitude',   value: lat },
      { trait_type: 'Longitude',  value: lng },
      { trait_type: 'Network',    value: 'Solana Devnet' },
    ],
    properties: {
      files: [{ uri: imageUrl, type: 'image/jpeg' }],
      category: 'image',
    },
  };

  return NextResponse.json(metadata, {
    headers: { 'Cache-Control': 'public, max-age=31536000' },
  });
}
