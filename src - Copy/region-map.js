// A real region mapping for every country this app supports — built
// specifically to fix a genuine gap: when a customer's own country has
// zero providers, suggesting "whichever country has the most total
// providers" isn't actually useful (a customer in Liberia gets no real
// value from being pointed at the US just because it has more sellers
// overall). A genuinely useful suggestion is a *nearby* country — same
// region, similar time zone, often similar culture/language — which is
// what a real platform like Uber or Airbnb would actually surface.
// Grouped using standard, practical sub-regions rather than raw
// continents, since "Africa" or "Asia" alone is too broad to be a
// meaningful "nearby" signal (Liberia and Kenya are both "Africa" but
// nothing close to neighbors).
const REGION_BY_COUNTRY = {
  // West Africa
  'Liberia': 'West Africa', 'Ghana': 'West Africa', 'Nigeria': 'West Africa', 'Sierra Leone': 'West Africa',
  "Cote d'Ivoire": 'West Africa', 'Senegal': 'West Africa', 'Mali': 'West Africa', 'Guinea': 'West Africa',
  'Guinea-Bissau': 'West Africa', 'Benin': 'West Africa', 'Togo': 'West Africa', 'Burkina Faso': 'West Africa',
  'Niger': 'West Africa', 'Gambia': 'West Africa', 'Cabo Verde': 'West Africa', 'Mauritania': 'West Africa',
  // East Africa
  'Kenya': 'East Africa', 'Tanzania': 'East Africa', 'Uganda': 'East Africa', 'Rwanda': 'East Africa',
  'Burundi': 'East Africa', 'Ethiopia': 'East Africa', 'Somalia': 'East Africa', 'Djibouti': 'East Africa',
  'Eritrea': 'East Africa', 'South Sudan': 'East Africa', 'Sudan': 'East Africa', 'Madagascar': 'East Africa',
  'Mauritius': 'East Africa', 'Seychelles': 'East Africa', 'Comoros': 'East Africa', 'Malawi': 'East Africa',
  'Mozambique': 'East Africa', 'Zambia': 'East Africa',
  // Central Africa
  'Cameroon': 'Central Africa', 'Chad': 'Central Africa', 'Central African Republic': 'Central Africa',
  'Congo (Brazzaville)': 'Central Africa', 'Congo (DRC)': 'Central Africa', 'Gabon': 'Central Africa',
  'Equatorial Guinea': 'Central Africa', 'Sao Tome and Principe': 'Central Africa', 'Angola': 'Central Africa',
  // Southern Africa
  'South Africa': 'Southern Africa', 'Namibia': 'Southern Africa', 'Botswana': 'Southern Africa',
  'Zimbabwe': 'Southern Africa', 'Lesotho': 'Southern Africa', 'Eswatini': 'Southern Africa',
  // North Africa
  'Egypt': 'North Africa', 'Libya': 'North Africa', 'Tunisia': 'North Africa', 'Algeria': 'North Africa',
  'Morocco': 'North Africa',
  // Western Europe
  'France': 'Western Europe', 'Germany': 'Western Europe', 'Netherlands': 'Western Europe', 'Belgium': 'Western Europe',
  'Luxembourg': 'Western Europe', 'Switzerland': 'Western Europe', 'Austria': 'Western Europe', 'Liechtenstein': 'Western Europe',
  'Monaco': 'Western Europe', 'Ireland': 'Western Europe', 'United Kingdom': 'Western Europe',
  // Northern Europe
  'Denmark': 'Northern Europe', 'Sweden': 'Northern Europe', 'Norway': 'Northern Europe', 'Finland': 'Northern Europe',
  'Iceland': 'Northern Europe', 'Estonia': 'Northern Europe', 'Latvia': 'Northern Europe', 'Lithuania': 'Northern Europe',
  // Southern Europe
  'Spain': 'Southern Europe', 'Portugal': 'Southern Europe', 'Italy': 'Southern Europe', 'Greece': 'Southern Europe',
  'Malta': 'Southern Europe', 'Cyprus': 'Southern Europe', 'San Marino': 'Southern Europe', 'Vatican City': 'Southern Europe',
  'Andorra': 'Southern Europe', 'Croatia': 'Southern Europe', 'Slovenia': 'Southern Europe', 'Bosnia and Herzegovina': 'Southern Europe',
  'Serbia': 'Southern Europe', 'Montenegro': 'Southern Europe', 'North Macedonia': 'Southern Europe', 'Albania': 'Southern Europe',
  'Kosovo': 'Southern Europe',
  // Eastern Europe
  'Poland': 'Eastern Europe', 'Czechia': 'Eastern Europe', 'Slovakia': 'Eastern Europe', 'Hungary': 'Eastern Europe',
  'Romania': 'Eastern Europe', 'Bulgaria': 'Eastern Europe', 'Ukraine': 'Eastern Europe', 'Belarus': 'Eastern Europe',
  'Moldova': 'Eastern Europe', 'Russia': 'Eastern Europe',
  // North America
  'United States': 'North America', 'Canada': 'North America', 'Mexico': 'North America',
  // Central America
  'Guatemala': 'Central America', 'Belize': 'Central America', 'Honduras': 'Central America', 'El Salvador': 'Central America',
  'Nicaragua': 'Central America', 'Costa Rica': 'Central America', 'Panama': 'Central America',
  // Caribbean
  'Cuba': 'Caribbean', 'Jamaica': 'Caribbean', 'Haiti': 'Caribbean', 'Dominican Republic': 'Caribbean',
  'Bahamas': 'Caribbean', 'Barbados': 'Caribbean', 'Trinidad and Tobago': 'Caribbean', 'Grenada': 'Caribbean',
  'Saint Lucia': 'Caribbean', 'Saint Vincent and the Grenadines': 'Caribbean', 'Saint Kitts and Nevis': 'Caribbean',
  'Antigua and Barbuda': 'Caribbean', 'Dominica': 'Caribbean',
  // South America
  'Brazil': 'South America', 'Argentina': 'South America', 'Chile': 'South America', 'Colombia': 'South America',
  'Peru': 'South America', 'Venezuela': 'South America', 'Ecuador': 'South America', 'Bolivia': 'South America',
  'Paraguay': 'South America', 'Uruguay': 'South America', 'Guyana': 'South America', 'Suriname': 'South America',
  // Middle East
  'Saudi Arabia': 'Middle East', 'United Arab Emirates': 'Middle East', 'Qatar': 'Middle East', 'Kuwait': 'Middle East',
  'Bahrain': 'Middle East', 'Oman': 'Middle East', 'Yemen': 'Middle East', 'Jordan': 'Middle East',
  'Lebanon': 'Middle East', 'Israel': 'Middle East', 'Palestine': 'Middle East', 'Syria': 'Middle East',
  'Iraq': 'Middle East', 'Iran': 'Middle East',
  // Central Asia
  'Kazakhstan': 'Central Asia', 'Uzbekistan': 'Central Asia', 'Turkmenistan': 'Central Asia', 'Tajikistan': 'Central Asia',
  'Kyrgyzstan': 'Central Asia', 'Afghanistan': 'Central Asia', 'Azerbaijan': 'Central Asia', 'Armenia': 'Central Asia',
  'Georgia': 'Central Asia', 'Turkey': 'Central Asia', 'Mongolia': 'Central Asia',
  // South Asia
  'India': 'South Asia', 'Pakistan': 'South Asia', 'Bangladesh': 'South Asia', 'Sri Lanka': 'South Asia',
  'Nepal': 'South Asia', 'Bhutan': 'South Asia', 'Maldives': 'South Asia',
  // East Asia
  'China': 'East Asia', 'Japan': 'East Asia', 'South Korea': 'East Asia', 'North Korea': 'East Asia', 'Taiwan': 'East Asia',
  // Southeast Asia
  'Indonesia': 'Southeast Asia', 'Philippines': 'Southeast Asia', 'Vietnam': 'Southeast Asia', 'Thailand': 'Southeast Asia',
  'Myanmar': 'Southeast Asia', 'Malaysia': 'Southeast Asia', 'Singapore': 'Southeast Asia', 'Cambodia': 'Southeast Asia',
  'Laos': 'Southeast Asia', 'Brunei': 'Southeast Asia', 'Timor-Leste': 'Southeast Asia',
  // Oceania
  'Australia': 'Oceania', 'New Zealand': 'Oceania', 'Papua New Guinea': 'Oceania', 'Fiji': 'Oceania',
  'Solomon Islands': 'Oceania', 'Vanuatu': 'Oceania', 'Samoa': 'Oceania', 'Tonga': 'Oceania', 'Kiribati': 'Oceania',
  'Micronesia': 'Oceania', 'Marshall Islands': 'Oceania', 'Palau': 'Oceania', 'Nauru': 'Oceania', 'Tuvalu': 'Oceania',
};

function regionForCountry(country) {
  return REGION_BY_COUNTRY[country] || null;
}

module.exports = { REGION_BY_COUNTRY, regionForCountry };
