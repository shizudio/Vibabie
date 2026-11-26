import countryCodes from 'i18n-iso-countries/codes.json'

// The phone publishes city/country text; visitors never grant location access.
const validCodes = new Set(countryCodes.map(([code]) => code))
const cityElement = document.querySelector('[data-location-city]')

if (cityElement) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 5000)

  fetch('/api/location', {
    signal: controller.signal,
    cache: 'no-store',
    credentials: 'omit',
  })
    .then(response => {
      if (!response.ok) throw new Error('Location unavailable')
      return response.json()
    })
    .then(({ city, countryCode }) => {
      // A soft navigation can replace the page while this request is pending.
      if (cityElement.isConnected && typeof city === 'string' && city.length <= 80 && city.trim()) {
        cityElement.textContent = city
        if (typeof countryCode === 'string' && validCodes.has(countryCode)) {
          const flag = document.createElement('span')
          flag.textContent = String.fromCodePoint(...[...countryCode].map(letter => 0x1F1E6 + letter.charCodeAt(0) - 65))
          let countryName = countryCode
          try {
            countryName = new Intl.DisplayNames([document.documentElement.lang || 'en'], { type: 'region' }).of(countryCode)
          } catch { /* The ISO code remains a readable fallback on older browsers. */ }
          flag.setAttribute('role', 'img')
          flag.setAttribute('aria-label', countryName)
          flag.title = countryName
          cityElement.append(' ', flag)
        }
      }
    })
    .catch(() => { /* Keep the existing city when offline or unconfigured. */ })
    .finally(() => clearTimeout(timeout))
}
