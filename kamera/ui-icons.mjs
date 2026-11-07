const paths={
 camera:'<path d="M3 6h13v12H3zM16 10l5-3v10l-5-3"/>',
 storage:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 14h18M7 17h1M11 17h1"/>',
 recording:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
 network:'<circle cx="5" cy="18" r="2"/><circle cx="19" cy="18" r="2"/><circle cx="12" cy="5" r="2"/><path d="m6 16 5-9m2 0 5 9M7 18h10"/>',
 cloud:'<path d="M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13 0 5 5 0 0 1 0 10Z"/>',
 agent:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
 home:'<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
 alerts:'<path d="M6 9a6 6 0 0 1 12 0c0 6 3 6 3 8H3c0-2 3-2 3-8M10 21h4"/>',
 archive:'<circle cx="12" cy="12" r="9"/><path d="m10 8 6 4-6 4z"/>',
 settings:'<path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>'
};
export function iconMarkup(name){return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.agent}</svg>`;}
