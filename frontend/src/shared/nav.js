export const products = [
  { to: '/tools', label: 'Open House Tools', short: 'Tools' },
  { to: '/realtor', label: 'Realtor', short: 'Realtor' },
  { to: '/referral', label: 'Referral', short: 'Referral' },
];

export const openHouseLinks = [
  { to: '/collect', label: 'Collect' },
  { to: '/open-house', label: 'Open House' },
  { to: '/workspace', label: 'Workspace' },
  { to: '/compare', label: 'Compare' },
];

export const realtorLinks = [
  { to: '/realtor/create', label: 'Create workspace' },
  { to: '/realtor/dashboard', label: 'Dashboard' },
];

export const referralLinks = [
  { to: '/referral/submit', label: 'Submit lead' },
  { to: '/referral/matches', label: 'Find matches' },
];

const openHousePaths = new Set(openHouseLinks.map((link) => link.to).concat('/tools'));

export function isOpenHousePath(pathname) {
  return openHousePaths.has(pathname)
    || pathname.startsWith('/workspace/')
    || pathname.startsWith('/w/');
}
