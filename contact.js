const form        = document.getElementById('contact-form')
const successState = document.getElementById('success-state')
const submitBtn   = form?.querySelector('.submit-btn')
const submitText  = form?.querySelector('.submit-text')

if (!form) throw new Error('contact-form not found')

form.addEventListener('submit', async (e) => {
  e.preventDefault()

  // Loading state
  submitBtn.disabled = true
  submitText.textContent = 'Sending…'

  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })

    if (res.ok) {
      // Show success, hide form
      form.style.display = 'none'
      successState.setAttribute('aria-hidden', 'false')
      // Hide the divider + channels below the form too
      document.querySelectorAll('.contact-form ~ .divider, .channels').forEach(el => {
        el.style.display = 'none'
      })
    } else {
      const data = await res.json()
      const msg = data?.errors?.map(e => e.message).join(', ') || 'Something went wrong.'
      showError(msg)
    }
  } catch {
    showError('Network error — try emailing directly.')
  }
})

function showError(msg) {
  submitBtn.disabled = false
  submitText.textContent = 'Send note'

  // Remove any existing error
  form.querySelector('.form-error')?.remove()

  const err = document.createElement('p')
  err.className = 'form-error'
  err.textContent = msg
  submitBtn.insertAdjacentElement('beforebegin', err)
}
