const PROVIDER_COLORS: Record<string, string> = {
    Netflix: '#e50914',
    Spotify: '#1db954',
    Adobe: '#fa0f00',
    Hulu: '#1ce783',
    Disney: '#113ccf',
    ChatGPT: '#74aa9c',
    AWS: '#ff9900',
    Notion: '#000000',
    Grammarly: '#15c39a',
    iCloud: '#3693f5',
    'New York Times': '#567b95',
    NYTimes: '#567b95',
    Amazon: '#ff9900',
    LinkedIn: '#0a66c2',
};

export function getProviderColor(name: string): string {
    const normalizedName = name.trim().toLowerCase();

    for (const [provider, color] of Object.entries(PROVIDER_COLORS)) {
        if (normalizedName.includes(provider.toLowerCase())) {
            return color;
        }
    }

    return '#6366f1';
}
