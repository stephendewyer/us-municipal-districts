a nation-wide search for municipal districts in the U.S. using geocoordinates

# Build npm package
npm run build

# Run tests
npm test

# Run everything
npm run check

# Search for potential municipal datasets
npm run discover

# Build municipal GeoJSON
npm run generate

# Discover client filtered http requests with city and state
npm run discover -- --city Tucson --state AZ
npm run discover -- --state AZ

# Discover client filtered http requests with placeFips
npm run discover -- --placeFips 0477000

# Discover client filtered http requests across the country
npm run discover 