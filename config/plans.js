// Add paid plans only in this object. The declaration order is the fallback
// upgrade rank; use a numeric `rank` only when a different order is required.
const PLANS = {
  plus: {
    monthly: 10000,
    yearly: 109000,
    features: ['themes'],
    label: 'Plus',
    maxGalaxies: 3,
  },
  pro: {
    monthly: 29000,
    yearly: 189000,
    // The legacy music catalog is quarantined until every track has a valid
    // commercial license. Original Lumora soundscapes are a free base feature.
    features: ['themes', 'text', 'fall_universe'],
    label: 'Pro',
    maxGalaxies: 10,
    featured: true,
  },
};

const PLAN_KEYS = Object.freeze(Object.keys(PLANS));
const PLAN_RANK = Object.freeze(Object.fromEntries(
  PLAN_KEYS.map((key, index) => [key, Number.isFinite(PLANS[key].rank) ? PLANS[key].rank : index + 1])
));
const FREE_MAX_GALAXIES = 1;

function planHasFeature(plan, feature) {
  return Boolean(PLANS[plan]?.features?.includes(feature));
}

module.exports = { PLANS, PLAN_KEYS, PLAN_RANK, FREE_MAX_GALAXIES, planHasFeature };
