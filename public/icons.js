const paths = {
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
  moon: '<path d="M20 14A8 8 0 0 1 10 4a8 8 0 1 0 10 10Z"/>',
  radio: '<rect x="3" y="8" width="18" height="13" rx="2"/><path d="m5 8 13-6M6 12h6m-6 4h3"/><circle cx="16" cy="15" r="2"/>',
  house: '<path d="m3 11 9-8 9 8v10H3Z M9 21v-8h6v8"/>',
  users: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-4a6 6 0 0 1 12 0v4m2-17a3 3 0 0 1 0 6m2 4a5 5 0 0 1 2 4v3"/>',
  footprints: '<ellipse cx="7" cy="6" rx="3" ry="4"/><path d="M4 12h5v5H4Z"/><ellipse cx="17" cy="12" rx="3" ry="4"/><path d="M15 18h5v4h-5Z"/>',
  'notebook-pen': '<path d="M18 12v9H4V3h9M2 7h4m-4 5h4m-4 5h4m4-5 9-9 3 3-9 9-4 1Z"/>',
  wheat: '<path d="M4 22 17 4m-7 10c-5 0-6-3-5-6 4 0 6 2 5 6Zm3-4c-4-1-5-4-3-7 4 1 5 3 3 7Zm-6 8c4 2 7 0 8-3-4-2-6-1-8 3Zm6-6c4 2 7 0 8-3-4-2-6-1-8 3Z"/>',
  droplets: '<path d="M8 3S2 10 2 14a6 6 0 0 0 12 0C14 10 8 3 8 3Zm10 5s-3 4-3 6a3 3 0 0 0 6 0c0-2-3-6-3-6Z"/>',
  package: '<path d="m12 2 9 5v10l-9 5-9-5V7Zm-9 5 9 5 9-5M12 12v10M7.5 4.5l9 5"/>',
  shield: '<path d="M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6Z"/>',
  cross: '<path d="M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z"/>',
  'map-pin': '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
};
export function paintIcons(root) {
  root.querySelectorAll('[data-lucide]').forEach(element => {
    const name = element.dataset.lucide;
    if (element.dataset.painted === name) return;
    element.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${paths[name] || paths.house}</svg>`;
    element.dataset.painted = name;
  });
}
