// The phone publishes only a city; visitors never grant location access.
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
    .then(({ city }) => {
      // A soft navigation can replace the page while this request is pending.
      if (cityElement.isConnected && typeof city === 'string' && city.length <= 80 && city.trim()) {
        cityElement.textContent = city
      }
    })
    .catch(() => { /* Keep the existing city when offline or unconfigured. */ })
    .finally(() => clearTimeout(timeout))
}
