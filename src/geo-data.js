// Real geographic reference data — not a handful of launch cities, but every
// country, with real state/province/region subdivisions for the countries
// most likely to have real users. This is intentionally NOT a city-level
// database: a full worldwide city list would be tens of thousands of
// entries and unusable as a dropdown. Instead, country + state/region are
// structured real data (a bounded, well-known dataset), and city stays a
// free-text field — the same pattern used by Uber, Amazon, and most real
// marketplaces at this scale. Matching then expands geographically: exact
// city first, then same state/region, then same country — see
// matchCandidateFilter() in marketplace.routes.js.

// Every UN-recognized country plus a few commonly included territories.
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan',
  'Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia',
  'Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo (Brazzaville)','Congo (DRC)',
  'Costa Rica',"Cote d'Ivoire",'Croatia','Cuba','Cyprus','Czechia','Denmark','Djibouti','Dominica','Dominican Republic',
  'Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland',
  'France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea',
  'Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq',
  'Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kosovo',
  'Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania',
  'Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius',
  'Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia',
  'Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway',
  'Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland',
  'Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino',
  'Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands',
  'Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland',
  'Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia',
  'Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan',
  'Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
];

// State/province/region subdivisions for countries most likely to have
// real users first (all four current launch countries in full, plus a
// broad set of other populous countries). Any country not listed here
// falls back to a single generic "Nationwide" region — matching still
// works correctly, it just won't have state-level expansion for that
// country until real regional data is added.
const STATES_BY_COUNTRY = {
  'United States': ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','District of Columbia','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'],
  'Nigeria': ['Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','Federal Capital Territory','Gombe','Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara'],
  'Ghana': ['Ahafo','Ashanti','Bono','Bono East','Central','Eastern','Greater Accra','North East','Northern','Oti','Savannah','Upper East','Upper West','Volta','Western','Western North'],
  'Liberia': ['Bomi','Bong','Gbarpolu','Grand Bassa','Grand Cape Mount','Grand Gedeh','Grand Kru','Lofa','Margibi','Maryland','Montserrado','Nimba','River Cess','River Gee','Sinoe'],
  'Canada': ['Alberta','British Columbia','Manitoba','New Brunswick','Newfoundland and Labrador','Northwest Territories','Nova Scotia','Nunavut','Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon'],
  'United Kingdom': ['England','Northern Ireland','Scotland','Wales'],
  'Kenya': ['Baringo','Bomet','Bungoma','Busia','Elgeyo-Marakwet','Embu','Garissa','Homa Bay','Isiolo','Kajiado','Kakamega','Kericho','Kiambu','Kilifi','Kirinyaga','Kisii','Kisumu','Kitui','Kwale','Laikipia','Lamu','Machakos','Makueni','Mandera','Marsabit','Meru','Migori','Mombasa','Muranga','Nairobi','Nakuru','Nandi','Narok','Nyamira','Nyandarua','Nyeri','Samburu','Siaya','Taita-Taveta','Tana River','Tharaka-Nithi','Trans Nzoia','Turkana','Uasin Gishu','Vihiga','Wajir','West Pokot'],
  'South Africa': ['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape'],
  'India': ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi'],
  'Australia': ['Australian Capital Territory','New South Wales','Northern Territory','Queensland','South Australia','Tasmania','Victoria','Western Australia'],
  'Germany': ['Baden-Wurttemberg','Bavaria','Berlin','Brandenburg','Bremen','Hamburg','Hesse','Lower Saxony','Mecklenburg-Vorpommern','North Rhine-Westphalia','Rhineland-Palatinate','Saarland','Saxony','Saxony-Anhalt','Schleswig-Holstein','Thuringia'],
  'Brazil': ['Acre','Alagoas','Amapa','Amazonas','Bahia','Ceara','Distrito Federal','Espirito Santo','Goias','Maranhao','Mato Grosso','Mato Grosso do Sul','Minas Gerais','Para','Paraiba','Parana','Pernambuco','Piaui','Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondonia','Roraima','Santa Catarina','Sao Paulo','Sergipe','Tocantins'],
  'Mexico': ['Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas','Chihuahua','Coahuila','Colima','Durango','Guanajuato','Guerrero','Hidalgo','Jalisco','Mexico City','Mexico State','Michoacan','Morelos','Nayarit','Nuevo Leon','Oaxaca','Puebla','Queretaro','Quintana Roo','San Luis Potosi','Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatan','Zacatecas'],
};

function statesForCountry(country) {
  return STATES_BY_COUNTRY[country] || ['Nationwide'];
}

// Real international calling codes (ITU-T E.164), one per country in the
// COUNTRIES list above — used to auto-fill the phone field's country code
// prefix at signup, so someone doesn't have to know or remember their own
// country's dial code.
const DIAL_CODE_BY_COUNTRY = {
  'Afghanistan': '+93', 'Albania': '+355', 'Algeria': '+213', 'Andorra': '+376', 'Angola': '+244',
  'Antigua and Barbuda': '+1268', 'Argentina': '+54', 'Armenia': '+374', 'Australia': '+61', 'Austria': '+43',
  'Azerbaijan': '+994', 'Bahamas': '+1242', 'Bahrain': '+973', 'Bangladesh': '+880', 'Barbados': '+1246',
  'Belarus': '+375', 'Belgium': '+32', 'Belize': '+501', 'Benin': '+229', 'Bhutan': '+975',
  'Bolivia': '+591', 'Bosnia and Herzegovina': '+387', 'Botswana': '+267', 'Brazil': '+55', 'Brunei': '+673',
  'Bulgaria': '+359', 'Burkina Faso': '+226', 'Burundi': '+257', 'Cabo Verde': '+238', 'Cambodia': '+855',
  'Cameroon': '+237', 'Canada': '+1', 'Central African Republic': '+236', 'Chad': '+235', 'Chile': '+56',
  'China': '+86', 'Colombia': '+57', 'Comoros': '+269', 'Congo (Brazzaville)': '+242', 'Congo (DRC)': '+243',
  'Costa Rica': '+506', "Cote d'Ivoire": '+225', 'Croatia': '+385', 'Cuba': '+53', 'Cyprus': '+357',
  'Czechia': '+420', 'Denmark': '+45', 'Djibouti': '+253', 'Dominica': '+1767', 'Dominican Republic': '+1809',
  'Ecuador': '+593', 'Egypt': '+20', 'El Salvador': '+503', 'Equatorial Guinea': '+240', 'Eritrea': '+291',
  'Estonia': '+372', 'Eswatini': '+268', 'Ethiopia': '+251', 'Fiji': '+679', 'Finland': '+358',
  'France': '+33', 'Gabon': '+241', 'Gambia': '+220', 'Georgia': '+995', 'Germany': '+49',
  'Ghana': '+233', 'Greece': '+30', 'Grenada': '+1473', 'Guatemala': '+502', 'Guinea': '+224',
  'Guinea-Bissau': '+245', 'Guyana': '+592', 'Haiti': '+509', 'Honduras': '+504', 'Hungary': '+36',
  'Iceland': '+354', 'India': '+91', 'Indonesia': '+62', 'Iran': '+98', 'Iraq': '+964',
  'Ireland': '+353', 'Israel': '+972', 'Italy': '+39', 'Jamaica': '+1876', 'Japan': '+81',
  'Jordan': '+962', 'Kazakhstan': '+7', 'Kenya': '+254', 'Kiribati': '+686', 'Kosovo': '+383',
  'Kuwait': '+965', 'Kyrgyzstan': '+996', 'Laos': '+856', 'Latvia': '+371', 'Lebanon': '+961',
  'Lesotho': '+266', 'Liberia': '+231', 'Libya': '+218', 'Liechtenstein': '+423', 'Lithuania': '+370',
  'Luxembourg': '+352', 'Madagascar': '+261', 'Malawi': '+265', 'Malaysia': '+60', 'Maldives': '+960',
  'Mali': '+223', 'Malta': '+356', 'Marshall Islands': '+692', 'Mauritania': '+222', 'Mauritius': '+230',
  'Mexico': '+52', 'Micronesia': '+691', 'Moldova': '+373', 'Monaco': '+377', 'Mongolia': '+976',
  'Montenegro': '+382', 'Morocco': '+212', 'Mozambique': '+258', 'Myanmar': '+95', 'Namibia': '+264',
  'Nauru': '+674', 'Nepal': '+977', 'Netherlands': '+31', 'New Zealand': '+64', 'Nicaragua': '+505',
  'Niger': '+227', 'Nigeria': '+234', 'North Korea': '+850', 'North Macedonia': '+389', 'Norway': '+47',
  'Oman': '+968', 'Pakistan': '+92', 'Palau': '+680', 'Palestine': '+970', 'Panama': '+507',
  'Papua New Guinea': '+675', 'Paraguay': '+595', 'Peru': '+51', 'Philippines': '+63', 'Poland': '+48',
  'Portugal': '+351', 'Qatar': '+974', 'Romania': '+40', 'Russia': '+7', 'Rwanda': '+250',
  'Saint Kitts and Nevis': '+1869', 'Saint Lucia': '+1758', 'Saint Vincent and the Grenadines': '+1784', 'Samoa': '+685', 'San Marino': '+378',
  'Sao Tome and Principe': '+239', 'Saudi Arabia': '+966', 'Senegal': '+221', 'Serbia': '+381', 'Seychelles': '+248',
  'Sierra Leone': '+232', 'Singapore': '+65', 'Slovakia': '+421', 'Slovenia': '+386', 'Solomon Islands': '+677',
  'Somalia': '+252', 'South Africa': '+27', 'South Korea': '+82', 'South Sudan': '+211', 'Spain': '+34',
  'Sri Lanka': '+94', 'Sudan': '+249', 'Suriname': '+597', 'Sweden': '+46', 'Switzerland': '+41',
  'Syria': '+963', 'Taiwan': '+886', 'Tajikistan': '+992', 'Tanzania': '+255', 'Thailand': '+66',
  'Timor-Leste': '+670', 'Togo': '+228', 'Tonga': '+676', 'Trinidad and Tobago': '+1868', 'Tunisia': '+216',
  'Turkey': '+90', 'Turkmenistan': '+993', 'Tuvalu': '+688', 'Uganda': '+256', 'Ukraine': '+380',
  'United Arab Emirates': '+971', 'United Kingdom': '+44', 'United States': '+1', 'Uruguay': '+598', 'Uzbekistan': '+998',
  'Vanuatu': '+678', 'Vatican City': '+379', 'Venezuela': '+58', 'Vietnam': '+84', 'Yemen': '+967',
  'Zambia': '+260', 'Zimbabwe': '+263',
};

function dialCodeForCountry(country) {
  return DIAL_CODE_BY_COUNTRY[country] || '';
}

module.exports = { COUNTRIES, STATES_BY_COUNTRY, statesForCountry, DIAL_CODE_BY_COUNTRY, dialCodeForCountry };
