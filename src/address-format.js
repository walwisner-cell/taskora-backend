// v167: Walter, on the sign-up form with Liberia chosen: "it does not use zip
// code, also the city, work on it". The form asked every country for a
// "Zip / Postal Code", named every region a "State / Region", and suggested
// "e.g. Philadelphia" as the city.
//
// The international standard for this is the address data Google publishes
// for every country (libaddressinput, used by Android, Chrome and most
// checkout forms) and the Universal Postal Union's address formats. They say,
// for each country:
//   - what the first division is called (a county in Liberia, Kenya and
//     Ireland, a region in Ghana, a province in Canada, a state in Nigeria
//     and the United States);
//   - whether a postal code is used at all, and what it is called
//     (ZIP code in the US, postcode in the UK, PIN code in India, Eircode);
//   - whether it must be given.
// This file holds that, in the words Trothen's forms show.
//
// Liberia: it has a 4-digit postal code on paper, but nobody uses it in
// daily life and post is collected from P.O. boxes. Ride and delivery apps
// there don't ask for one, so Trothen doesn't either.
const { NO_POSTAL_CODE_COUNTRIES, POSTAL_CODE_OPTIONAL_COUNTRIES } = require('./validators');
const { CITIES_BY_STATE } = require('./geo-data');

// Countries with no postal code in daily use: the box is not shown. Those
// where it is optional: the box is shown and may be left empty.
const POSTAL_NONE = NO_POSTAL_CODE_COUNTRIES, POSTAL_OPTIONAL = POSTAL_CODE_OPTIONAL_COUNTRIES;

// What the first division is called (Google's address data, "state_name_type").
const REGION = {
  county: ['Liberia', 'Kenya', 'Ireland', 'United Kingdom', 'Hungary', 'Croatia', 'Estonia', 'Latvia', 'Lithuania', 'Romania', 'Norway', 'Sweden', 'Taiwan'],
  region: ['Ghana', 'Sierra Leone', 'Guinea', 'Gambia', 'Senegal', 'Cameroon', 'Ivory Coast', "Cote d'Ivoire", 'Mali', 'Burkina Faso', 'Togo', 'Benin', 'Niger', 'Tanzania', 'Uganda', 'Ethiopia', 'Chile', 'Peru', 'Italy', 'France', 'Denmark', 'Finland', 'Portugal', 'Czech Republic', 'Slovakia', 'Morocco', 'Tunisia', 'New Zealand', 'Namibia', 'Eritrea'],
  province: ['Canada', 'South Africa', 'China', 'Zambia', 'Zimbabwe', 'Rwanda', 'Burundi', 'Mozambique', 'Angola', 'Congo (DRC)', 'Democratic Republic of the Congo', 'Philippines', 'Argentina', 'Spain', 'Netherlands', 'Belgium', 'Indonesia', 'Thailand', 'Vietnam', 'Pakistan', 'Afghanistan', 'Iran', 'Turkey', 'Dominican Republic', 'Ecuador', 'Panama', 'Costa Rica', 'Cuba', 'Sri Lanka', 'Papua New Guinea', 'Algeria', 'Gabon'],
  district: ['Botswana', 'Malawi', 'Uganda', 'Nepal', 'Bangladesh'],
  governorate: ['Egypt', 'Jordan', 'Lebanon', 'Iraq', 'Syria', 'Yemen', 'Kuwait', 'Oman', 'Bahrain'],
  prefecture: ['Japan', 'Greece'],
  parish: ['Jamaica', 'Barbados', 'Antigua and Barbuda', 'Dominica', 'Grenada', 'Saint Kitts and Nevis', 'Saint Vincent and the Grenadines'],
  department: ['Haiti', 'Colombia', 'Guatemala', 'Honduras', 'El Salvador', 'Nicaragua', 'Paraguay', 'Uruguay', 'Bolivia'],
  emirate: ['United Arab Emirates'],
};
const REGION_OF = new Map();
for (const [kind, list] of Object.entries(REGION)) for (const c of list) if (!REGION_OF.has(c)) REGION_OF.set(c, kind);
const REGION_LABEL = { state: 'State', county: 'County', region: 'Region', province: 'Province', district: 'District', governorate: 'Governorate', prefecture: 'Prefecture', parish: 'Parish', department: 'Department', emirate: 'Emirate' };

// What the postal code is called.
const POSTAL_LABEL = { 'United States': 'ZIP code', 'Philippines': 'ZIP code', 'United Kingdom': 'Postcode', 'Australia': 'Postcode', 'New Zealand': 'Postcode', 'South Africa': 'Postal code', 'India': 'PIN code', 'Ireland': 'Eircode', 'Brazil': 'CEP', 'Italy': 'CAP', 'Germany': 'Postleitzahl (PLZ)', 'Switzerland': 'Postal code (NPA/PLZ)', 'Japan': 'Postal code' };

// A city to show as the example, so the hint fits the country.
const CITY_EXAMPLE = { 'United States': 'Philadelphia', 'Liberia': 'Monrovia', 'Nigeria': 'Lagos', 'Ghana': 'Accra', 'Sierra Leone': 'Freetown', 'Kenya': 'Nairobi', 'United Kingdom': 'Manchester', 'Canada': 'Toronto', 'Guinea': 'Conakry', "Cote d'Ivoire": 'Abidjan', 'Ivory Coast': 'Abidjan', 'South Africa': 'Johannesburg', 'India': 'Mumbai', 'Australia': 'Sydney', 'Ireland': 'Dublin', 'Gambia': 'Banjul', 'Senegal': 'Dakar', 'Cameroon': 'Douala', 'Uganda': 'Kampala', 'Tanzania': 'Dar es Salaam', 'Rwanda': 'Kigali', 'Germany': 'Berlin', 'France': 'Paris' };

function formatFor(country) {
  const kind = REGION_OF.get(country) || 'state';
  const postal = POSTAL_NONE.has(country) ? 'none' : POSTAL_OPTIONAL.has(country) ? 'optional' : 'required';
  const states = (CITIES_BY_STATE && CITIES_BY_STATE[country]) || null;
  const firstCity = states ? Object.values(states)[0][0] : '';
  return {
    region: REGION_LABEL[kind],
    city: country === 'Liberia' || country === 'Sierra Leone' || country === 'Ghana' ? 'City or town' : 'City',
    postal,
    postalLabel: POSTAL_LABEL[country] || 'Postal code',
    cityExample: CITY_EXAMPLE[country] || firstCity || '',
  };
}

module.exports = { formatFor, POSTAL_NONE, POSTAL_OPTIONAL };
